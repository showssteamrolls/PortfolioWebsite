import React, { useState } from 'react';
import './index.scss';

const Timeline = () => {
  const [events, setEvents] = useState([
    {
      date: 'Jan 2026 – Jun 2026',
      title: 'Commercial & Marketing Analyst @ Wayfair',
      description: [
      ],
      expanded: false,
    },
    {
      date: 'Nov 2024 – Feb 2025',
      title: 'Data Consultant @ Techsalerator',
      description: [
        'Prospect 300+ leads weekly to connect businesses and consumers to relevant datasets',
        'Evaluate outreach metrics to redirect efforts toward highest-yield channels, similar to digital campaign analysis',
        'Carry an inviting curiosity to engage leads & stakeholders in sharing their needs and concerns',
      ],
      expanded: false,
    },
    {
      date: 'Jan 2024 – Present',
      title: 'TA: Ecological Economics @ Northeastern University',
      description: [
      ],
      expanded: false,
    },
    {
      date: 'May 2025 – July 2025',
      title: 'Summer Debate Instructor @ Yiyang International Education',
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
