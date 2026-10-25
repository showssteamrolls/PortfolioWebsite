import React, { useState } from "react";
import ProgressBar, { PALETTE } from "../ProgressBar";
import "./index.scss"

const TechList = () => {
  // bar width = years / 2.5 (the longest bar)
  const [devs] = useState([
    { name: "Git", years: 2, progress: 80 },
    { name: "GitHub", years: 2, progress: 80 },
    { name: "Vercel", years: 2, progress: 80 },
    { name: "Microsoft & Google Suites", years: 2.5, progress: 100 },
    { name: "Anaconda", years: 1.5, progress: 60 },
    { name: "Visual Studio", years: 1.5, progress: 60 },
    { name: "Docker", years: 1, progress: 40 },
    { name: "Looker", years: 1, progress: 40 },
    { name: "Tableau", years: 1, progress: 40 },
    { name: "PowerBI", years: 1, progress: 40 },
    { name: "GCP", years: 1, progress: 40 },
    { name: "Snowflake", years: 1, progress: 40 },
    { name: "Cursor", years: 1, progress: 40 }
  ]);

  return (
    <div>
      <h2>Development Tools</h2>
      <ul>
        {devs.map((dev, index) => (
          <li key={index}>
            <span>{dev.name}: {`${dev.years} years`}</span>
            <ProgressBar progress={dev.progress} className="" color={PALETTE[index % PALETTE.length]} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TechList;
