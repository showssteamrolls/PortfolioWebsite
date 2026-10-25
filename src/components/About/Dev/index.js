import "./index.scss"; 
import AnimatedLetters from "../../AnimatedLetters"
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "react-loaders";
import DevList from "../DevList";
import TechCube from "../TechCube";
import { cubeLogos } from "../TechCube/logos";


const About = () => {
    
    const [letterClass, setLetterClass] = useState("text-animate");

    useEffect(() => {
        const timerId = setTimeout(() => {
            setLetterClass("text-animate-hover");
        }, 3000);
      
        return () => {
            clearTimeout(timerId);
        };
    }, []);

    return (
        <>
            <div className="container about-page"> 
                <div className="text-zone"> 
                    <h1>
                        <AnimatedLetters
                            letterClass={letterClass}
                            strArray={"About me".split("")}
                            idx={15}
                        />
                    </h1>
                    <p>
                        Ambitious data scientist & team player who solves problems creatively.
                        <br/>
                        <DevList />
                        <Link to="/about" className="flat-button">LANGUAGES</Link>
                        <br/>
                        <Link to="/about/tech" className="flat-button">FRAMEWORKS/TECHNOLOGIES</Link>
                    </p>
                </div>

                <div className="stage-cube-cont tech-stage">
                    <TechCube logos={cubeLogos} />
                </div>
            </div>
            <Loader type="pacman" />
        </>
    )
}

export default About
