import React, { useState } from 'react';
import './index.scss';

const Timeline = () => {
  const [events, setEvents] = useState([
    {
      date: 'Jun 2025 – Aug 2026',
      title: 'AI & Machine Learning Instructor @ Yiyang International Education',
      description: ['Bringing AI & machine learning to the younger generation, by: breaking down core conceptual intuitions simply, connecting to real-world impact, and designing interactive classwork.'
      ],
      expanded: false,
    },
    {
      date: 'Jun 2026 – Dec 2026',
      title: 'Data Analyst Co-op @ Wayfair',
      description: ['Using data to navigate a complex problem space–– ads.',
                    'My favorite projects throughout my term (all-focused on direct business impact):',
                    '  1) ML Conversion Rate Predictor -> efficientized ad spend (~65k/year)',
                    '  2) Individual Ad Performance Dashboard -> saved time/effort by centralizing insights',
                    '  3) Audience Targeting A/B Test -> achieved 46% lower CPM, 1.6x return on ad spend'
      ],
      expanded: false,
    },
    {
      date: 'Nov 2024 – Feb 2025',
      title: 'Data Consultant Intern @ Techsalerator',
      description: [
      ],
      expanded: false,
    },
    {
      date: 'Jan 2024 – Present',
      title: 'Graduate Teaching Assistant @ Northeastern University',
      description: [
      ],
      expanded: false,
    },
    {
      date: 'Nov 2022 – July 2023',
      title: 'Assistant Debate Instructor @ New England Academy',
      description: [
      ],
      expanded: false,
    }
  ]);

  const handleItemClick = (index) => {
    setEvents((prevEvents) => {
      const updatedEvents = prevEvents.map((event, idx) => {
        if (idx === index) {
          return { ...event, expanded: !event.expanded };
        }
        return event;
      });
      return updatedEvents;
    });
  };

  return (
    <div className="timeline-container">
      {events.map((event, index) => (
        <div
          className={`timeline-item ${event.expanded ? 'expanded' : ''}`}
          key={index}
          onClick={() => handleItemClick(index)}
        >
          <div className="timeline-marker"></div>
          <div className="timeline-content">
            <h2>{event.title}</h2>
            {event.expanded ? (
              <div>
                {event.description.map((desc, descIndex) => (
                  <p key={descIndex} dangerouslySetInnerHTML={{ __html: desc }} />
                ))}
              </div>
            ) : (
              <>
                <div className="more">
                  <p>Click for more</p>
                </div>
                <div className="date">{event.date}</div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;
