import React, { useState } from 'react';
import './App.css';

function App() {
  const [subjects, setSubjects] = useState([{ name: '', chapters: '' }]);
  const [examDate, setExamDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [plan, setPlan] = useState(null);

  const handleSubjectChange = (index, field, value) => {
    const newSubjects = [...subjects];
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const addSubject = () => {
    setSubjects([...subjects, { name: '', chapters: '' }]);
  };

  const removeSubject = (index) => {
    if (subjects.length > 1) {
      const newSubjects = [...subjects];
      newSubjects.splice(index, 1);
      setSubjects(newSubjects);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // We'll implement plan generation later
    console.log({ subjects, examDate, startDate, dailyHours });
    setPlan({
      // Temporary mock data
      subjects: subjects.filter(s => s.name && s.chapters),
      days: 30,
      hoursPerDay: dailyHours
    });
  };

  // ... rest of the component code
  return (
    <div className="app">
      <header>
        <h1>Personalized Study Planner</h1>
        <p>Plan your study schedule effectively</p>
      </header>
      
      <main>
        <form onSubmit={handleSubmit}>
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
    <label>Exam Date:</label>
    <input 
      type="date" 
      value={examDate}
      onChange={(e) => setExamDate(e.target.value)}
      required 
    />
  </div>
  
  <div className="form-group">
    <label>Daily Study Hours:</label>
    <input 
      type="number" 
      min="1" 
      max="24" 
      value={dailyHours}
      onChange={(e) => setDailyHours(e.target.value)}
      required 
    />
  </div>
  
  <div className="subjects-container">
    <h3>Subjects</h3>
    {subjects.map((subject, index) => (
      <div key={index} className="subject-input">
        <input
          type="text"
          placeholder="Subject name"
          value={subject.name}
          onChange={(e) => handleSubjectChange(index, 'name', e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Chapters"
          min="1"
          value={subject.chapters}
          onChange={(e) => handleSubjectChange(index, 'chapters', e.target.value)}
          required
        />
        <button 
          type="button" 
          className="remove-btn"
          onClick={() => removeSubject(index)}
        >
          ×
        </button>
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
  
  <button type="submit" className="generate-btn">Generate Plan</button>
</form>
        
        <section className="output-section">
  <h2>Your Study Plan</h2>
  
  {plan ? (
    <div className="plan-results">
      <div className="plan-summary">
        <p><strong>Total Days:</strong> {plan.days}</p>
        <p><strong>Daily Hours:</strong> {plan.hoursPerDay}</p>
        <p><strong>Total Subjects:</strong> {plan.subjects.length}</p>
      </div>
      
      <div className="daily-plan">
        <h3>Sample Day</h3>
        <ul>
          {plan.subjects.map((subject, index) => (
            <li key={index}>
              <strong>{subject.name}</strong>: {subject.chapters} chapters
            </li>
          ))}
        </ul>
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