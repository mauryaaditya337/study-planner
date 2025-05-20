import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [subjects, setSubjects] = useState([{ 
    name: '', 
    examDate: '',
    chapters: [{ name: '', hours: '' }] 
  }]);
  const [startDate, setStartDate] = useState('');
  const [dailyHours, setDailyHours] = useState('');
  const [availableDays, setAvailableDays] = useState([
    { day: 'Monday', checked: true },
    { day: 'Tuesday', checked: true },
    { day: 'Wednesday', checked: true },
    { day: 'Thursday', checked: true },
    { day: 'Friday', checked: true },
    { day: 'Saturday', checked: false },
    { day: 'Sunday', checked: false }
  ]);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const planRef = useRef();

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Reset everything
  const handleReset = () => {
    setSubjects([{ 
      name: '', 
      examDate: '',
      chapters: [{ name: '', hours: '' }] 
    }]);
    setStartDate('');
    setDailyHours('');
    setAvailableDays([
      { day: 'Monday', checked: true },
      { day: 'Tuesday', checked: true },
      { day: 'Wednesday', checked: true },
      { day: 'Thursday', checked: true },
      { day: 'Friday', checked: true },
      { day: 'Saturday', checked: false },
      { day: 'Sunday', checked: false }
    ]);
    setPlan(null);
    setError('');
  };

  // Subject handlers
  const handleSubjectChange = (subjectIndex, field, value) => {
    const newSubjects = [...subjects];
    newSubjects[subjectIndex][field] = value;
    setSubjects(newSubjects);
  };

  const addSubject = () => {
    setSubjects([...subjects, { 
      name: '', 
      examDate: '',
      chapters: [{ name: '', hours: '' }] 
    }]);
  };

  const removeSubject = (subjectIndex) => {
    if (subjects.length > 1) {
      const newSubjects = [...subjects];
      newSubjects.splice(subjectIndex, 1);
      setSubjects(newSubjects);
    }
  };

  // Chapter handlers
  const handleChapterChange = (subjectIndex, chapterIndex, field, value) => {
    const newSubjects = [...subjects];
    newSubjects[subjectIndex].chapters[chapterIndex][field] = value;
    setSubjects(newSubjects);
  };

  const addChapter = (subjectIndex) => {
    const newSubjects = [...subjects];
    newSubjects[subjectIndex].chapters.push({ name: '', hours: '' });
    setSubjects(newSubjects);
  };

  const removeChapter = (subjectIndex, chapterIndex) => {
    const newSubjects = [...subjects];
    if (newSubjects[subjectIndex].chapters.length > 1) {
      newSubjects[subjectIndex].chapters.splice(chapterIndex, 1);
      setSubjects(newSubjects);
    }
  };

  // Day selection handlers
  const toggleDay = (dayIndex) => {
    const newDays = [...availableDays];
    newDays[dayIndex].checked = !newDays[dayIndex].checked;
    setAvailableDays(newDays);
  };

  // Validate decimal input for hours
  const validateHours = (value) => {
    if (value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    if (num < 0) return 0;
    if (num > 24) return 24;
    return value;
  };

  const handleDailyHoursChange = (e) => {
    setDailyHours(validateHours(e.target.value));
  };

  const handleChapterHoursChange = (subjectIndex, chapterIndex, value) => {
    const validatedValue = validateHours(value);
    handleChapterChange(subjectIndex, chapterIndex, 'hours', validatedValue);
  };

  // Validate dates
  const validateDates = (startDate, examDates) => {
    const start = new Date(startDate);
    for (const examDate of examDates) {
      if (new Date(examDate) < start) {
        return `Exam date (${examDate}) cannot be before start date (${startDate})`;
      }
    }
    return '';
  };

  const calculateStudyPlan = () => {
    // Filter valid subjects
    const validSubjects = subjects.filter(subject => 
      subject.name && 
      subject.examDate && 
      subject.chapters.some(chapter => chapter.name && chapter.hours)
    ).map(subject => ({
      ...subject,
      chapters: subject.chapters.filter(chapter => chapter.name && chapter.hours)
    }));

    if (validSubjects.length === 0) {
      setError('Please add at least one valid subject with chapters');
      return null;
    }

    if (!startDate) {
      setError('Please select a start date');
      return null;
    }

    if (!dailyHours || parseFloat(dailyHours) <= 0) {
      setError('Please enter valid daily study hours');
      return null;
    }

    const selectedDays = availableDays.filter(day => day.checked).map(day => day.day);
    if (selectedDays.length === 0) {
      setError('Please select at least one study day');
      return null;
    }

    // Validate exam dates
    const examDates = validSubjects.map(subject => subject.examDate);
    const dateError = validateDates(startDate, examDates);
    if (dateError) {
      setError(dateError);
      return null;
    }

    // Calculate total hours needed
    const totalHoursNeeded = validSubjects.reduce((total, subject) => {
      return total + subject.chapters.reduce((sum, chapter) => sum + parseFloat(chapter.hours), 0);
    }, 0);

    // Calculate total available hours
    const start = new Date(startDate);
    const endDates = validSubjects.map(subject => new Date(subject.examDate));
    const earliestEndDate = new Date(Math.min(...endDates));
    
    let currentDate = new Date(start);
    let studyDays = 0;
    
    while (currentDate <= earliestEndDate) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      if (selectedDays.includes(dayName)) studyDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const dailyHoursValue = parseFloat(dailyHours);
    const totalAvailableHours = studyDays * dailyHoursValue;

    if (totalHoursNeeded > totalAvailableHours) {
      setError(`Not enough time! You need ${totalHoursNeeded.toFixed(1)} hours but only have ${totalAvailableHours.toFixed(1)} available. Please increase daily study hours or reduce workload.`);
      return null;
    }

    setError('');
    
    // Sort subjects by exam date (earliest first)
    const sortedSubjects = [...validSubjects].sort((a, b) => 
      new Date(a.examDate) - new Date(b.examDate)
    );

    // Generate study schedule
    const studySchedule = [];
    currentDate = new Date(start);
    
    // Create a list of study dates
    const studyDates = [];
    while (currentDate <= earliestEndDate) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      if (selectedDays.includes(dayName)) {
        studyDates.push({
          date: currentDate.toISOString().split('T')[0],
          day: dayName
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create a flattened list of all chapters with subject reference
    const allChapters = [];
    sortedSubjects.forEach(subject => {
      subject.chapters.forEach(chapter => {
        allChapters.push({
          subject: subject.name,
          examDate: subject.examDate,
          name: chapter.name,
          hours: parseFloat(chapter.hours),
          hoursRemaining: parseFloat(chapter.hours)
        });
      });
    });

    // Distribute chapters across study days
    studyDates.forEach(studyDate => {
      const dayPlan = {
        date: studyDate.date,
        day: studyDate.day,
        subjects: [],
        totalHours: 0
      };

      let hoursAvailable = dailyHoursValue;
      
      // Find chapters that need to be scheduled
      for (let i = 0; i < allChapters.length && hoursAvailable > 0; i++) {
        const chapter = allChapters[i];
        if (chapter.hoursRemaining <= 0) continue;

        const hoursToSchedule = Math.min(chapter.hoursRemaining, hoursAvailable);
        
        dayPlan.subjects.push({
          subject: chapter.subject,
          chapter: chapter.name,
          hours: hoursToSchedule
        });
        
        dayPlan.totalHours += hoursToSchedule;
        hoursAvailable -= hoursToSchedule;
        chapter.hoursRemaining -= hoursToSchedule;
      }

      if (dayPlan.subjects.length > 0) {
        studySchedule.push(dayPlan);
      }
    });

    return {
      subjects: sortedSubjects,
      schedule: studySchedule,
      totalHoursNeeded,
      totalAvailableHours,
      dailyHours: dailyHoursValue,
      studyDays: selectedDays,
      startDate
    };
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Prepare the data to send to backend
  const requestData = {
    subjects: subjects.filter(subject => 
      subject.name && 
      subject.examDate && 
      subject.chapters.some(chapter => chapter.name && chapter.hours)
    ).map(subject => ({
      ...subject,
      chapters: subject.chapters.filter(chapter => chapter.name && chapter.hours)
    })),
    startDate,
    dailyHours,
    availableDays: availableDays.filter(day => day.checked).map(day => day.day)
  };

  try {
    const response = await fetch('https://study-planner-mbm0.onrender.com/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.json();

    if (data.error) {
      setError(data.error);
      setPlan(null);
    } else {
      setError('');
      setPlan(data);
    }
  } catch (err) {
    setError('Failed to connect to the server. Please try again.');
    setPlan(null);
  }
};

  const handlePrint = () => {
    const printContents = planRef.current.innerHTML;
    const originalContents = document.body.innerHTML;
    
    document.body.innerHTML = `
      <div class="print-container">
        <h1>Study Plan</h1>
        <div class="print-summary">
          <p><strong>Start Date:</strong> ${plan.startDate}</p>
          <p><strong>Daily Study Hours:</strong> ${plan.dailyHours}</p>
          <p><strong>Study Days:</strong> ${plan.studyDays.join(', ')}</p>
          <p><strong>Total Hours Needed:</strong> ${plan.totalHoursNeeded.toFixed(1)}</p>
          <p><strong>Total Available Hours:</strong> ${plan.totalAvailableHours.toFixed(1)}</p>
        </div>
        <div class="print-plan">${printContents}</div>
      </div>
      <style>
        body { font-family: Arial; padding: 20px; }
        .print-container { max-width: 800px; margin: 0 auto; }
        .print-summary { 
          background: #f5f5f5; 
          padding: 15px; 
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .print-summary p { margin: 5px 0; }
        .print-plan { margin-top: 20px; }
        .day-plan { 
          margin-bottom: 30px; 
          page-break-inside: avoid;
          border: 1px solid #eee;
          padding: 15px;
          border-radius: 5px;
        }
        .day-plan h4 { 
          margin: 0 0 10px 0;
          color: #2c3e50;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
          font-size: 14px;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left; 
        }
        th { 
          background-color: #2c3e50; 
          color: white; 
        }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .total-row { font-weight: bold; }
        @media print {
          .no-print { display: none; }
          body { padding: 0; }
          .day-plan { 
            margin-bottom: 20px;
            border: none;
            padding: 0;
          }
        }
      </style>
    `;
    
    window.print();
    document.body.innerHTML = originalContents;
  };

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <header className="app-header">
        <div className="header-content">
          <h1>Personalized Study Planner</h1>
          <p>Plan your study schedule effectively</p>
        </div>
        <button 
          onClick={() => setDarkMode(!darkMode)} 
          className="dark-mode-toggle"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>
      
      <main>
        <section className="input-section">
          <div className="section-header">
            <h2>Create Your Study Plan</h2>
            <button onClick={handleReset} className="reset-btn">
              Reset All
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date:</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Daily Study Hours (0-24):</label>
                <input 
                  type="number" 
                  min="0" 
                  max="24" 
                  step="0.1"
                  value={dailyHours}
                  onChange={handleDailyHoursChange}
                  required 
                  placeholder="e.g. 2.5"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Available Study Days:</label>
              <div className="days-checkboxes">
                {availableDays.map((day, index) => (
                  <label key={day.day} className="day-checkbox">
                    <input
                      type="checkbox"
                      checked={day.checked}
                      onChange={() => toggleDay(index)}
                    />
                    <span>{day.day}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="subjects-container">
              <h3>Subjects</h3>
              
              {subjects.map((subject, subjectIndex) => (
                <div key={subjectIndex} className="subject-card">
                  <div className="subject-header">
                    <div className="subject-input-group">
                      <div className="form-group">
                        <label>Subject Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Mathematics"
                          value={subject.name}
                          onChange={(e) => handleSubjectChange(subjectIndex, 'name', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Exam Date</label>
                        <input
                          type="date"
                          value={subject.examDate}
                          onChange={(e) => handleSubjectChange(subjectIndex, 'examDate', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="remove-btn"
                      onClick={() => removeSubject(subjectIndex)}
                      title="Remove Subject"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="chapters-container">
                    <h4>Chapters</h4>
                    {subject.chapters.map((chapter, chapterIndex) => (
                      <div key={chapterIndex} className="chapter-row">
                        <div className="form-group">
                          <input
                            type="text"
                            placeholder="Chapter name"
                            value={chapter.name}
                            onChange={(e) => handleChapterChange(subjectIndex, chapterIndex, 'name', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <input
                            type="number"
                            placeholder="Hours"
                            min="0"
                            step="0.1"
                            value={chapter.hours}
                            onChange={(e) => handleChapterHoursChange(subjectIndex, chapterIndex, e.target.value)}
                            required
                          />
                        </div>
                        <button 
                          type="button" 
                          className="remove-btn small"
                          onClick={() => removeChapter(subjectIndex, chapterIndex)}
                          title="Remove Chapter"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      className="add-chapter"
                      onClick={() => addChapter(subjectIndex)}
                    >
                      + Add Chapter
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                type="button" 
                className="add-subject"
                onClick={addSubject}
              >
                + Add Subject
              </button>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="generate-btn">Generate Plan</button>
            </div>
          </form>
        </section>
        
        <section className="output-section">
          <div className="output-header">
            <h2>Your Study Plan</h2>
            {plan && (
              <div className="output-actions">
                <button onClick={handlePrint} className="print-btn">
                  Print Schedule
                </button>
              </div>
            )}
          </div>
          
          {plan ? (
            <div className="plan-results" ref={planRef}>
              <div className="plan-summary">
                <h3>Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Start Date:</span>
                    <span className="summary-value">{plan.startDate}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Daily Hours:</span>
                    <span className="summary-value">{plan.dailyHours}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Study Days:</span>
                    <span className="summary-value">{plan.studyDays.join(', ')}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Needed:</span>
                    <span className="summary-value">{plan.totalHoursNeeded.toFixed(1)} hours</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Available:</span>
                    <span className="summary-value">{plan.totalAvailableHours.toFixed(1)} hours</span>
                  </div>
                </div>
              </div>
              
              <div className="schedule-container">
                <h3>Daily Schedule</h3>
                {plan.schedule.map((day, index) => (
                  <div key={index} className="day-plan">
                    <h4>{day.date} ({day.day}) - Total: {day.totalHours.toFixed(1)} hours</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Chapter</th>
                          <th>Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.subjects.map((item, i) => (
                          <tr key={i}>
                            <td>{item.subject}</td>
                            <td>{item.chapter}</td>
                            <td>{item.hours.toFixed(1)}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td colSpan="2">Total</td>
                          <td>{day.totalHours.toFixed(1)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Fill out the form to generate your personalized study plan</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;