import './index.scss'

// The page-change transition: a white "A" that fills with blue from the bottom up,
// then the screen fades away to reveal the page.
const PageLoader = () => (
    <div className="page-loader" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="page-loader-mark">
            <defs>
                <clipPath id="page-loader-a">
                    <path
                        fillRule="evenodd"
                        d="M4 96 L38 6 L62 6 L96 96 L70 96 L61.7 74 L38.3 74 L30 96 Z M50 43 L54.9 56 L45.1 56 Z"
                    />
                </clipPath>
            </defs>
            <path
                className="outline"
                fillRule="evenodd"
                d="M4 96 L38 6 L62 6 L96 96 L70 96 L61.7 74 L38.3 74 L30 96 Z M50 43 L54.9 56 L45.1 56 Z"
            />
            <g clipPath="url(#page-loader-a)">
                <rect className="fill" x="0" y="0" width="100" height="100" />
            </g>
        </svg>
    </div>
)

export default PageLoader
