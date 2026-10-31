import "./index.scss"
import PageLoader from "../PageLoader";
import AnimatedLetters from "../AnimatedLetters" 
import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLinkedin } from "@fortawesome/free-brands-svg-icons"
import { faEnvelope } from "@fortawesome/free-solid-svg-icons"

const Contact = () => {
    const [letterClass, setLetterClass] = useState('text-animate')

    useEffect(() => {
        const timerId = setTimeout(() => {
          setLetterClass('text-animate-hover');
        }, 3000);
      
        return () => {
          clearTimeout(timerId);
        };
      }, []);

    return(
        <>
            <div className = "container contact-page">
                <div className = "text-zone">
                    <table>
                        <tr>
                            <td className="left-side">
                                <h1>
                                    <AnimatedLetters letterClass={letterClass} strArray = {"Contact me".split("")} idx = {15} />
                                </h1>
                                <p>
                                    <br/>
                                    Let's connect! 
                                    <br/>
                                    <br/>Happy to take any inquiries, feedback, or collaboration opportunities!
                                    <br/>
                                    <br/>
                                    <a target = "_blank" rel = "noreferrer" href = "https://www.linkedin.com/in/anthony-tian-54a64134a/">
                                        <FontAwesomeIcon icon={faLinkedin}  class = "icon" color = "#4d4d4e" />
                                    </a>
                                    <a target = "_blank" rel = "noreferrer" href = "mailto:tian.ruy@northeastern.edu">
                                        <FontAwesomeIcon icon={faEnvelope} class = "icon" color = "#4d4d4e" />
                                    </a>
                                </p>
                            </td>
                            <td className="right-side">
                                <a className="resume-card" href="/Anthony_Tian_Resume.pdf?v=2" target="_blank" rel="noreferrer" aria-label="Open resume PDF">
                                    <img src="/resume-preview.png?v=2" alt="Anthony Tian resume" />
                                </a>
                                <a className="flat-button resume-button" href="/Anthony_Tian_Resume.pdf?v=2" download="Anthony_Tian_Resume.pdf">DOWNLOAD RESUME</a>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <PageLoader />
        </>
    )
}

export default Contact