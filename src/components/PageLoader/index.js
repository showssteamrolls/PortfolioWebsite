import './index.scss'

// The page-change transition: a white "A" with a blue outline that fills with blue from the bottom up,
// then the screen fades away to reveal the page.
const PageLoader = () => (
    <div className="page-loader" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="page-loader-mark">
            <defs>
                <clipPath id="page-loader-a">
                    <path d="M0 100 L50.4 0 L100 100 L81.5 100 L50.4 36.1 L18.5 100 Z" />
                    <path d="M42 62.4 L58.3 62.4 L65.5 76.9 L35 76.9 Z" />
                </clipPath>
            </defs>
            <g className="outline">
                <path d="M0 100 L50.4 0 L100 100 L81.5 100 L50.4 36.1 L18.5 100 Z" />
                <path d="M42 62.4 L58.3 62.4 L65.5 76.9 L35 76.9 Z" />
            </g>
            <g clipPath="url(#page-loader-a)">
                <rect className="fill" x="0" y="0" width="100" height="100" />
            </g>
            <g className="stroke">
                <path d="M0 100 L50.4 0 L100 100 L81.5 100 L50.4 36.1 L18.5 100 Z" />
                <path d="M42 62.4 L58.3 62.4 L65.5 76.9 L35 76.9 Z" />
            </g>
        </svg>
    </div>
)

export default PageLoader
