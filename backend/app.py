from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
from dateutil import parser

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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

@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    """API endpoint to generate study plan."""
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
    
    return jsonify(result)

@app.route('/')
def home():
    return jsonify({"message": "Study Planner API is running!"})

if __name__ == '__main__':
    app.run(debug=True)