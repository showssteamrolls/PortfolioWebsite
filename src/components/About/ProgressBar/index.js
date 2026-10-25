import React from "react";
import "./index.scss"

// One muted palette for every bar on the site, picked by position in the list.
export const PALETTE = ["#82ABF6", "#F69C96", "#92D6B0", "#F6CF80", "#B5A5EC", "#80D2DA"];

const ProgressBar = ({ progress, className, color }) => {
  const progressBarStyles = {
    width: `${progress}%`,
    ...(color ? { backgroundColor: color } : {}),
  };

  return (
    <div className={`progress-bar ${className}`}>
      <div className="progress" style={progressBarStyles}></div>
    </div>
  );
};

export default ProgressBar;
