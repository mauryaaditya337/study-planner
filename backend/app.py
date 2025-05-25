from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
from dateutil import parser
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash
import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.parse as urlparse
import logging

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
logging.basicConfig(level=logging.INFO)
app.logger = logging.getLogger(__name__)

# Initialize Flask-HTTPAuth
auth = HTTPBasicAuth()

# Security configuration
users = {
    os.environ.get('ADMIN_USER', 'admin'): generate_password_hash(os.environ.get('ADMIN_PASS', 'securepassword'))
}

@auth.verify_password
def verify_password(username, password):
    if username in users and check_password_hash(users.get(username), password):
        return username
    return None

@auth.error_handler
def unauthorized():
    return jsonify({
        "error": "Unauthorized access",
        "message": "Please provide valid admin credentials"
    }), 401



# App configuration
if os.environ.get('RENDER'):
    app.config.update(
        PREFERRED_URL_SCHEME='https',
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax'
    )
# Initialize database
def init_db():
    conn = sqlite3.connect('analytics.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS plan_stats
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp DATETIME,
                  subjects_count INTEGER,
                  total_hours REAL)''')
    conn.commit()
    conn.close()
init_db()  # Call this when app starts
def get_db_connection():
    if os.environ.get('RENDER'):
        # Parse database URL for production
        db_url = os.environ.get('DATABASE_URL')
        
        # Critical Fix 1: Handle connection string format
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
            
        # Critical Fix 2: Add SSL requirement
        conn = psycopg2.connect(
            db_url, 
            cursor_factory=RealDictCursor,
            sslmode='require'  # ← This is essential for Render
        )
        
        # Create table if not exists (PostgreSQL version)
        with conn.cursor() as cursor:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS plan_stats (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP NOT NULL,
                    subjects_count INTEGER NOT NULL,
                    total_hours FLOAT NOT NULL
                )
            ''')
            conn.commit()
        return conn
    else:
        # Local SQLite development (keep this unchanged)
        conn = sqlite3.connect('analytics.db')
        conn.row_factory = sqlite3.Row
        
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS plan_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                subjects_count INTEGER,
                total_hours REAL
            )
        ''')
        conn.commit()
        return conn
def generate_study_dates(start_date, end_date, available_days):
    """Generate list of study dates between start and end dates, considering available days."""
    dates = []
    current_date = start_date
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    while current_date <= end_date:
        current_day_name = day_names[current_date.weekday()]
        if current_day_name in available_days:
            dates.append(current_date.strftime('%Y-%m-%d'))
        current_date += timedelta(days=1)
    return dates

def generate_study_plan(subjects, start_date, daily_hours, available_days):
    """Generate the study schedule based on input parameters."""
    try:
        # Parse and validate inputs
        start_date = parser.parse(start_date).date()
        daily_hours = float(daily_hours)
        
        # Sort subjects by exam date (earliest first)
        subjects_sorted = sorted(
            subjects, 
            key=lambda x: parser.parse(x['examDate']).date()
        )
        
        # Calculate end date (earliest exam date)
        exam_dates = [parser.parse(subj['examDate']).date() for subj in subjects_sorted]
        end_date = min(exam_dates)
        
        # Generate all available study dates
        study_dates = generate_study_dates(start_date, end_date, available_days)
        
        if not study_dates:
            return {"error": "No study days available based on your selected days"}
        
        # Flatten all chapters with subject reference
        all_chapters = []
        for subject in subjects_sorted:
            for chapter in subject['chapters']:
                all_chapters.append({
                    'subject': subject['name'],
                    'examDate': subject['examDate'],
                    'chapter': chapter['name'],
                    'hours': float(chapter['hours']),
                    'hoursRemaining': float(chapter['hours'])
                })
        
        # Calculate total hours needed
        total_hours_needed = sum(chapter['hours'] for chapter in all_chapters)
        total_available_hours = len(study_dates) * daily_hours
        
        if total_hours_needed > total_available_hours:
            return {
                "error": f"Not enough time! You need {total_hours_needed:.1f} hours but only have {total_available_hours:.1f} available."
            }
        
        # Distribute chapters across study days
        schedule = []
        current_chapter_index = 0
        
        for study_date in study_dates:
            day_plan = {
                "date": study_date,
                "day": parser.parse(study_date).strftime('%A'),
                "subjects": [],
                "totalHours": 0
            }
            
            hours_remaining = daily_hours
            
            while hours_remaining > 0 and current_chapter_index < len(all_chapters):
                chapter = all_chapters[current_chapter_index]
                
                # Calculate hours to assign (could be partial)
                hours_to_assign = min(chapter['hoursRemaining'], hours_remaining)
                
                day_plan['subjects'].append({
                    "subject": chapter['subject'],
                    "chapter": chapter['chapter'],
                    "hours": hours_to_assign
                })
                day_plan['totalHours'] += hours_to_assign
                
                # Update remaining hours
                chapter['hoursRemaining'] -= hours_to_assign
                hours_remaining -= hours_to_assign
                
                # Move to next chapter if current one is completed
                if chapter['hoursRemaining'] <= 0:
                    current_chapter_index += 1
            
            schedule.append(day_plan)
        
        return {
            "schedule": schedule,
            "subjects": subjects_sorted,
            "totalHoursNeeded": total_hours_needed,
            "totalAvailableHours": total_available_hours,
            "startDate": start_date.strftime('%Y-%m-%d'),
            "dailyHours": daily_hours,
            "studyDays": available_days
        }
        
    except Exception as e:
        return {"error": f"An error occurred: {str(e)}"}

# Global counter (optional)
plan_count = 0

@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    global plan_count
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['subjects', 'startDate', 'dailyHours', 'availableDays']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Generate the plan
        result = generate_study_plan(
            data['subjects'],
            data['startDate'],
            data['dailyHours'],
            data['availableDays']
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Track analytics
        plan_count += 1
        
        # Store in database
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            
            if os.environ.get('RENDER'):
                # PostgreSQL syntax
                cursor.execute('''
                    INSERT INTO plan_stats 
                    (timestamp, subjects_count, total_hours)
                    VALUES (%s, %s, %s)
                ''', (
                    datetime.now().isoformat(),
                    len(data['subjects']),
                    result['totalHoursNeeded']
                ))
            else:
                # SQLite syntax
                cursor.execute('''
                    INSERT INTO plan_stats 
                    (timestamp, subjects_count, total_hours)
                    VALUES (?, ?, ?)
                ''', (
                    datetime.now().isoformat(),
                    len(data['subjects']),
                    result['totalHoursNeeded']
                ))
            
            conn.commit()
        finally:
            conn.close()
        
        print(f"Generated {plan_count} study plans so far")
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stats')
@auth.login_required
def get_stats():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get total plans
        if os.environ.get('RENDER'):
            cursor.execute('SELECT COUNT(*) as count FROM plan_stats')
        else:
            cursor.execute('SELECT COUNT(*) FROM plan_stats')
        total_plans = cursor.fetchone()['count'] if os.environ.get('RENDER') else cursor.fetchone()[0]
        
        # Get average subjects per plan
        if os.environ.get('RENDER'):
            cursor.execute('SELECT AVG(subjects_count) as avg FROM plan_stats')
        else:
            cursor.execute('SELECT AVG(subjects_count) FROM plan_stats')
        avg_subjects = cursor.fetchone()['avg'] if os.environ.get('RENDER') else cursor.fetchone()[0]
        
        # Get average hours per plan
        if os.environ.get('RENDER'):
            cursor.execute('SELECT AVG(total_hours) as avg FROM plan_stats')
        else:
            cursor.execute('SELECT AVG(total_hours) FROM plan_stats')
        avg_hours = cursor.fetchone()['avg'] if os.environ.get('RENDER') else cursor.fetchone()[0]
        
        # Get last 7 days activity
        if os.environ.get('RENDER'):
            cursor.execute('''
                SELECT DATE(timestamp) as day, COUNT(*) as count
                FROM plan_stats
                WHERE timestamp > CURRENT_DATE - INTERVAL '7 days'
                GROUP BY DATE(timestamp)
                ORDER BY day
            ''')
        else:
            cursor.execute('''
                SELECT DATE(timestamp) as day, COUNT(*) as count
                FROM plan_stats
                WHERE timestamp > DATE('now', '-7 days')
                GROUP BY DATE(timestamp)
                ORDER BY day
            ''')
        
        if os.environ.get('RENDER'):
            weekly_activity = [{"day": str(row['day']), "count": row['count']} for row in cursor.fetchall()]
        else:
            weekly_activity = [{"day": row[0], "count": row[1]} for row in cursor.fetchall()]
        
        return jsonify({
            "status": "success",
            "total_plans_generated": total_plans or 0,
            "average_subjects_per_plan": round(float(avg_subjects or 0), 1),
            "average_hours_per_plan": round(float(avg_hours or 0), 1),
            "weekly_activity": weekly_activity
        })
    except Exception as e:
        app.logger.error(f"Error in /stats: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/')
def home():
    return jsonify({"message": "Study Planner API is running!"})

@app.route('/health')
def health_check():
    try:
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            return jsonify({
                "status": "healthy",
                "database": "connected",
                "timestamp": datetime.now().isoformat()
            })
        finally:
            conn.close()
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500
    
# Add this temporary test route
@app.route('/test-db')
def test_db():
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({"status": "DB connection successful"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    app.run(debug=True)
    
