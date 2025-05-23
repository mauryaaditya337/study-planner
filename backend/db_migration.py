# db_migration.py
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if running in production
    is_postgres = os.environ.get('RENDER')
    
    if is_postgres:
        # PostgreSQL schema
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS plan_stats (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            subjects_count INTEGER NOT NULL,
            total_hours FLOAT NOT NULL
        );
        ''')
        
        # Create index if not exists (PostgreSQL syntax)
        cursor.execute('''
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = 'idx_timestamp'
            ) THEN
                CREATE INDEX idx_timestamp ON plan_stats(timestamp);
            END IF;
        END$$;
        ''')
    else:
        # SQLite schema
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS plan_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            subjects_count INTEGER NOT NULL,
            total_hours REAL NOT NULL
        );
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_timestamp ON plan_stats(timestamp);
        ''')
    
    conn.commit()
    conn.close()