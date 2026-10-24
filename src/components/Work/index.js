import './index.scss'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Loader from 'react-loaders'
import AnimatedLetters from '../AnimatedLetters'
import workData from '../../data/work.json'

const jobs = workData.jobs

const OFFSET = 8 // px a card sits above its checkpoint so its first line meets the connector
const GAP = 46 // px between a checkpoint and its card
const RAIL = 150 // px reserved on the right for the contents rail

const useMedia = (query) => {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
    useEffect(() => {
        const mq = window.matchMedia(query)
        const onChange = () => setMatches(mq.matches)
        onChange()
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [query])
    return matches
}

// Lay the checkpoints out down the page, alternating sides, and join them with
// one smooth curve. Every checkpoint has a vertical tangent, so the line is
// monotonic in y: scroll position maps cleanly onto a point on the line.
const buildGeometry = (w, h, n) => {
    const contentW = w - RAIL
    const cx = contentW / 2
    const S = Math.max(380, h * 0.72)
    const A = Math.min(contentW * 0.13, 180)
    const wiggle = [1, 0.7, 1.1, 0.8, 1.05, 0.75]
    const y0 = 170
    const cardW = Math.max(180, Math.min(360, cx - A * 1.1 - GAP - 30))

    const nodes = Array.from({ length: n }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1
        return { x: cx + side * A * wiggle[i % wiggle.length], y: y0 + S * (i + 1), side }
    })

    const pts = [{ x: cx, y: y0 }, ...nodes]
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1]
        const b = pts[i]
        const k = (b.y - a.y) * 0.55
        d += ` C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`
    }

    const yEnd = nodes[n - 1].y
    return { contentW, cx, S, y0, yEnd, cardW, nodes, d, sceneH: yEnd + h }
}

// Look up the point on the line at a given y using a precomputed table.
const sample = (t, y) => {
    let lo = 0
    let hi = t.count
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (t.ys[mid] <= y) lo = mid
        else hi = mid
    }
    const span = t.ys[hi] - t.ys[lo] || 1
    const f = Math.min(1, Math.max(0, (y - t.ys[lo]) / span))
    return {
        x: t.xs[lo] + (t.xs[hi] - t.xs[lo]) * f,
        len: t.ls[lo] + (t.ls[hi] - t.ls[lo]) * f,
    }
}

const JobCard = ({ job }) => {
    const meta = [job.kind, job.location].filter(Boolean).join(' · ')
    return (
        <>
            <span className="job-dates">{job.dates}</span>
            <h2 className="job-company">{job.company}</h2>
            <p className="job-role">
                {job.title}
                {job.subtitle ? ` · ${job.subtitle}` : ''}
            </p>
            <div className="job-more">
                <div className="job-more-inner">
                    <p className="job-meta">{meta}</p>
                    {job.caption.map((line, i) => (
                        <p className="job-line" key={i}>{line}</p>
                    ))}
                    {job.bullets.length > 0 && (
                        <ol className="job-bullets">
                            {job.bullets.map((b, i) => (
                                <li key={i}>{b}</li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </>
    )
}

const Title = ({ letterClass }) => (
    <h1>
        <AnimatedLetters letterClass={letterClass} strArray={'Work Experience'.split('')} idx={10} />
    </h1>
)

const Journey = ({ letterClass }) => {
    const reduced = useMedia('(prefers-reduced-motion: reduce)')
    const reducedRef = useRef(reduced)
    reducedRef.current = reduced

    const scrollerRef = useRef(null)
    const sceneRef = useRef(null)
    const trackPathRef = useRef(null)
    const progRef = useRef(null)
    const markerRef = useRef(null)
    const cardRefs = useRef([])
    const tableRef = useRef(null)
    const geoRef = useRef(null)
    const sizeRef = useRef({ w: 0, h: 0 })
    const anim = useRef({ target: 0, current: 0, raf: 0, last: 0, active: -2, reached: -1 })

    const [size, setSize] = useState({ w: 0, h: 0 })
    const [view, setView] = useState({ active: -1, reached: 0 })

    const geo = useMemo(
        () => (size.w ? buildGeometry(size.w, size.h, jobs.length) : null),
        [size]
    )

    // Move the camera, the marker, the drawn line and the cards for a given
    // progress (0 to 1). Runs every frame, so it writes straight to the DOM.
    const paint = useCallback((p) => {
        const g = geoRef.current
        const t = tableRef.current
        if (!g || !t) return
        const h = sizeRef.current.h
        const my = g.y0 + p * (g.yEnd - g.y0)
        const { x: mx, len } = sample(t, my)

        sceneRef.current.style.transform =
            `translate3d(${(-(mx - g.cx) * 0.25).toFixed(2)}px, ${(h * 0.42 - my).toFixed(2)}px, 0)`
        markerRef.current.setAttribute('transform', `translate(${mx.toFixed(2)} ${my.toFixed(2)})`)
        progRef.current.style.strokeDashoffset = String(t.L - len)

        let active = -1
        let best = Infinity
        let reached = 0
        g.nodes.forEach((n, i) => {
            const dy = Math.abs(n.y - my)
            if (n.y <= my + 2) reached += 1
            if (dy < best) {
                best = dy
                active = i
            }
            const el = cardRefs.current[i]
            if (el) {
                const near = Math.max(0, Math.min(1, 1 - (dy - 0.25 * h) / (0.6 * h)))
                const z = reducedRef.current ? 0 : -Math.min(dy, h) * 0.22
                el.style.opacity = (0.1 + 0.9 * near).toFixed(3)
                el.style.transform = `translate3d(0, ${-OFFSET}px, ${z.toFixed(1)}px)`
            }
        })
        if (best > g.S * 0.5) active = -1

        const a = anim.current
        if (a.active !== active || a.reached !== reached) {
            a.active = active
            a.reached = reached
            setView({ active, reached })
        }
    }, [])

    const tick = useCallback((now) => {
        const a = anim.current
        const dt = Math.min(0.05, (now - a.last) / 1000) || 0.016
        a.last = now
        const k = reducedRef.current ? 1 : 1 - Math.exp(-dt * 7)
        a.current += (a.target - a.current) * k
        if (Math.abs(a.target - a.current) < 0.00004) a.current = a.target
        paint(a.current)
        a.raf = a.current === a.target ? 0 : requestAnimationFrame(tick)
    }, [paint])

    const kick = useCallback(() => {
        const a = anim.current
        if (!a.raf) {
            a.last = performance.now()
            a.raf = requestAnimationFrame(tick)
        }
    }, [tick])

    // Track the size of the scroll area.
    useLayoutEffect(() => {
        const el = scrollerRef.current
        const measure = () => {
            const w = el.clientWidth
            const h = el.clientHeight
            setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Whenever the geometry changes, re-measure the line and repaint.
    useLayoutEffect(() => {
        geoRef.current = geo
        sizeRef.current = size
        const path = trackPathRef.current
        if (!geo || !path) return

        const L = path.getTotalLength()
        const count = 800
        const xs = new Float64Array(count + 1)
        const ys = new Float64Array(count + 1)
        const ls = new Float64Array(count + 1)
        for (let k = 0; k <= count; k += 1) {
            const len = (L * k) / count
            const pt = path.getPointAtLength(len)
            xs[k] = pt.x
            ys[k] = pt.y
            ls[k] = len
        }
        tableRef.current = { L, xs, ys, ls, count }
        progRef.current.style.strokeDasharray = String(L)

        const a = anim.current
        scrollerRef.current.scrollTop = a.target * (geo.yEnd - geo.y0)
        a.current = a.target
        paint(a.target)
    }, [geo, size, paint])

    useEffect(() => {
        const a = anim.current
        return () => cancelAnimationFrame(a.raf)
    }, [])

    const onScroll = () => {
        const g = geoRef.current
        if (!g) return
        const a = anim.current
        a.target = Math.min(1, Math.max(0, scrollerRef.current.scrollTop / (g.yEnd - g.y0)))
        kick()
    }

    const goTo = (i) => {
        const g = geoRef.current
        if (!g) return
        scrollerRef.current.scrollTo({
            top: g.nodes[i].y - g.y0,
            behavior: reducedRef.current ? 'auto' : 'smooth',
        })
    }

    return (
        <>
            <div
                className="journey-scroll"
                ref={scrollerRef}
                onScroll={onScroll}
                tabIndex={0}
                role="region"
                aria-label="Work experience. Scroll to travel along the path."
            >
                {geo && (
                    <div className="journey-track" style={{ height: size.h + (geo.yEnd - geo.y0) }}>
                        <div
                            className="journey-stage"
                            style={{ height: size.h, perspectiveOrigin: `${geo.cx}px ${size.h * 0.42}px` }}
                        >
                            <div
                                className="journey-scene"
                                ref={sceneRef}
                                style={{ width: geo.contentW, height: geo.sceneH }}
                            >
                                <svg
                                    className="journey-svg"
                                    width={geo.contentW}
                                    height={geo.sceneH}
                                    viewBox={`0 0 ${geo.contentW} ${geo.sceneH}`}
                                    aria-hidden="true"
                                >
                                    <defs>
                                        <linearGradient
                                            id="journeyGrad"
                                            gradientUnits="userSpaceOnUse"
                                            x1="0"
                                            y1={geo.y0}
                                            x2="0"
                                            y2={geo.yEnd}
                                        >
                                            <stop offset="0" stopColor="#00b4d8" />
                                            <stop offset="1" stopColor="#275DFA" />
                                        </linearGradient>
                                    </defs>
                                    <path ref={trackPathRef} className="track" d={geo.d} />
                                    <g ref={progRef}>
                                        <path className="glow" d={geo.d} stroke="url(#journeyGrad)" />
                                        <path className="progress" d={geo.d} stroke="url(#journeyGrad)" />
                                    </g>
                                    <circle className="origin" cx={geo.cx} cy={geo.y0} r="4" />
                                    {geo.nodes.map((n, i) => (
                                        <g
                                            key={jobs[i].id}
                                            className={[
                                                'node',
                                                i < view.reached ? 'reached' : '',
                                                view.active === i ? 'active' : '',
                                            ].join(' ')}
                                            transform={`translate(${n.x} ${n.y})`}
                                        >
                                            <circle className="ring" r="16" />
                                            <circle className="core" r="6" />
                                        </g>
                                    ))}
                                    <g ref={markerRef} className="marker">
                                        <circle className="halo" r="14" />
                                        <circle className="dot" r="5" />
                                    </g>
                                </svg>

                                <div className="journey-intro" style={{ width: geo.contentW }}>
                                    <Title letterClass={letterClass} />
                                    <p className="hint">
                                        Scroll to follow the path · most recent first <span className="chev">↓</span>
                                    </p>
                                </div>

                                {jobs.map((job, i) => {
                                    const n = geo.nodes[i]
                                    const left = n.side < 0 ? n.x - GAP - geo.cardW : n.x + GAP
                                    return (
                                        <article
                                            key={job.id}
                                            ref={(el) => { cardRefs.current[i] = el }}
                                            className={[
                                                'job-card',
                                                n.side < 0 ? 'on-left' : 'on-right',
                                                view.active === i ? 'open' : '',
                                            ].join(' ')}
                                            style={{ left, top: n.y, width: geo.cardW }}
                                        >
                                            <JobCard job={job} />
                                        </article>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <nav className="journey-rail" aria-label="Experience contents">
                <span className="rail-title">Experience</span>
                <ol>
                    {jobs.map((job, i) => (
                        <li
                            key={job.id}
                            className={[i < view.reached ? 'reached' : '', view.active === i ? 'active' : ''].join(' ')}
                        >
                            <button
                                type="button"
                                onClick={() => goTo(i)}
                                aria-current={view.active === i ? 'true' : undefined}
                            >
                                <span className="label">{job.short}</span>
                                <span className="tick" />
                            </button>
                        </li>
                    ))}
                </ol>
            </nav>
        </>
    )
}

// Small screens and tablets: a plain stacked list, no camera.
const FlatList = ({ letterClass }) => (
    <div className="journey-scroll flat">
        <Title letterClass={letterClass} />
        <ol className="flat-list">
            {jobs.map((job) => (
                <li key={job.id} className="job-card flat-card open">
                    <JobCard job={job} />
                </li>
            ))}
        </ol>
    </div>
)

const Work = () => {
    const compact = useMedia('(max-width: 1000px)')
    const [letterClass, setLetterClass] = useState('text-animate')

    useEffect(() => {
        const timerId = setTimeout(() => {
            setLetterClass('text-animate-hover')
        }, 3000)
        return () => clearTimeout(timerId)
    }, [])

    return (
        <>
            <div className={`work-journey${compact ? ' compact' : ''}`}>
                {compact ? <FlatList letterClass={letterClass} /> : <Journey letterClass={letterClass} />}
            </div>
            <Loader type="pacman" />
        </>
    )
}

export default Work
