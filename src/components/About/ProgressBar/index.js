import React from "react";
import "./index.scss"

// One muted palette for every bar on the site, picked by position in the list.
export const PALETTE = ["#6E9BF0", "#EE8C86", "#7FC8A0", "#F0C36E", "#A592E0", "#6CC3CC"];

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
