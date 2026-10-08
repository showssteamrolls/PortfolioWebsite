import React, { useState } from "react";
import ProgressBar from "../ProgressBar";
import "./index.scss"

const TechList = () => {
  const [devs] = useState([
    { name: "Git", className: "bar-red", years: 2 },
    { name: "Looker", className: "bar-blue", years: 1.5 },
    { name: "PowerBI", className: "bar-yellow", years: 1.5 }
  ]);
  const maxYears = Math.max(...devs.map((d) => d.years));

  return (
    <div>
      <h2>Development Tools</h2>
      <ul>
        {devs.map((dev, index) => (
          <li key={index}>
            <span>{dev.name}: {`${dev.years} years`}</span>
            <ProgressBar progress={(dev.years / maxYears) * 100} className={dev.className} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TechList;
