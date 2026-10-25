import './index.scss'
import PageLoader from "../PageLoader";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import AnimatedLetters from '../AnimatedLetters'
import { loadWorld, sampleTrack, TRACK, PRE } from './scene'
import workData from '../../data/work.json'

const jobs = workData.jobs

const OFFSET = 8 // px a card sits above its checkpoint so its first line meets the connector
const GAP = 46 // px between a checkpoint and its card
const RAIL = 150 // px reserved on the right for the contents rail
const KEY_SPEED = 650 // scroll px per second while W / S is held
const WRONG_SPEED = 0.25 // how fast the car moves when going backwards from the start
const WRONG_RUN = 0.3 // how far back (in stops' worth of scrolling) you can go from the start
const CARD_W = 380

const clamp01 = (v) => Math.min(1, Math.max(0, v))

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

// The circuit is Laguna Seca (see scene.js). The journey starts on the
// start/finish line, stops at every other turn (1, 3, 5, 7, 9, 11) and ends back on
// the line. "j" is scroll distance: every stop gets the same amount of scrolling,
// however far apart the turns really are.
const buildGeometry = (w, h, n) => {
    const contentW = w - RAIL
    const S = Math.max(420, h * 0.68)
    const aX = contentW / 2
    const aY = Math.min(Math.max(h - 520, h * 0.34), h * 0.56) // leaves room under the open card
    const cardW = Math.max(200, Math.min(CARD_W, aX - GAP - 30))

    const nodes = TRACK.nodes.slice(0, n).map((nd, i) => ({ ...nd, w: cardW, j: S * (i + 1) }))
    const a = sampleTrack(0)
    const b = sampleTrack(60)
    const dl = Math.hypot(b.x - a.x, b.z - a.z) || 1

    return {
        contentW, S, P: S * (n + 1), aX, aY, nodes,
        start: a,
        startDir: { x: (b.x - a.x) / dl, z: (b.z - a.z) / dl },
        titleBack: S * 0.45 + PRE + 60, // the title stands behind the start line, so the path never crosses it
    }
}

// Monotone cubic through (x, y) knots: smooth, never doubles back. Used to turn
// scroll distance into distance along the line, so speed eases between stops.
const monotone = (xs, ys) => {
    const n = xs.length
    const delta = []
    for (let i = 0; i < n - 1; i += 1) delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
    const m = delta.map((_, i) => 0)
    m.push(0)
    m[0] = delta[0]
    m[n - 1] = delta[n - 2]
    for (let i = 1; i < n - 1; i += 1) {
        m[i] = delta[i - 1] * delta[i] > 0
            ? (2 * delta[i - 1] * delta[i]) / (delta[i - 1] + delta[i])
            : 0
    }
    return (x) => {
        let i = 0
        while (i < n - 2 && x > xs[i + 1]) i += 1
        const h = xs[i + 1] - xs[i]
        const u = Math.min(1, Math.max(0, (x - xs[i]) / h))
        const u2 = u * u
        const u3 = u2 * u
        return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i]
            + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1]
    }
}

// A rounded square for a company logo. Drop an image at
// public/work-logos/<job id>.png (or set "logo" in work.json) and it appears;
// until then a soft placeholder with the company's first letter is shown.
const JobLogo = ({ job }) => {
    const [loaded, setLoaded] = useState(false)
    const src = job.logo || `${process.env.PUBLIC_URL}/work-logos/${job.id}.png`
    return (
        <div className="job-logo" role="img" aria-label={`${job.company} logo`}>
            <span className="job-logo-initial">{job.company.charAt(0)}</span>
            <img
                src={src}
                alt=""
                className={loaded ? 'is-loaded' : ''}
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(false)}
            />
        </div>
    )
}

const JobCard = ({ job }) => {
    const meta = [job.kind, job.location].filter(Boolean).join(' · ')
    return (
        <>
            {job.dates ? <span className="job-dates">{job.dates}</span> : null}
            <div className="job-head">
                {!job.noLogo && <JobLogo job={job} />}
                <div className="job-titles">
                    <h2 className="job-company">{job.company}</h2>
                    {job.title ? (
                        <p className="job-role">
                            <span className="role-line">{job.title}</span>
                            {job.subtitle ? <span className="role-line">{job.subtitle}</span> : null}
                        </p>
                    ) : null}
                </div>
            </div>
            <div className="job-more">
                <div className="job-more-inner">
                    {meta ? <p className="job-meta">{meta}</p> : null}
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

const Journey = ({ letterClass, onFail }) => {
    const reduced = useMedia('(prefers-reduced-motion: reduce)')
    const reducedRef = useRef(reduced)
    reducedRef.current = reduced

    const scrollerRef = useRef(null)
    const canvasRef = useRef(null)
    const worldRef = useRef(null)
    const introRef = useRef(null)
    const wrongRef = useRef(null)
    const cardRefs = useRef([])
    const dotRefs = useRef([])
    const tableRef = useRef(null)
    const geoRef = useRef(null)
    const sizeRef = useRef({ w: 0, h: 0 })
    const anim = useRef({ target: 0, current: 0, raf: 0, last: 0, active: -2, reached: -1, shift: 0 })

    const [size, setSize] = useState({ w: 0, h: 0 })
    const [view, setView] = useState({ active: -1, reached: 0 })

    const geo = useMemo(
        () => (size.w ? buildGeometry(size.w, size.h, jobs.length) : null),
        [size]
    )

    // Move the camera along the line for a given progress (0 to 1), then place
    // each sign where the 3D scene says its checkpoint is. Runs every frame, so it
    // writes straight to the DOM.
    const paint = useCallback((p) => {
        const g = geoRef.current
        const t = tableRef.current
        const world = worldRef.current
        if (!g || !t || !world) return

        // p is the scroll position in px; the middle lap of the scroll range is lap 0
        // Going backwards from the very start (only before the first lap) is the
        // wrong way: the car crawls at a quarter of the speed
        const sh = anim.current.shift
        let jm = p - g.P + sh * g.P
        if (sh === 0 && p < g.P) jm = (p - g.P) * WRONG_SPEED
        const wrong = sh === 0 && jm < 0 ? clamp01(-jm / (0.05 * g.S)) : 0
        if (wrongRef.current) wrongRef.current.classList.toggle('on', wrong > 0.2)
        const lap = Math.floor(jm / g.P)
        const jmod = jm - lap * g.P
        const len = t.toLen(jmod) + lap * TRACK.L
        const cam = sampleTrack(len).cam
        world.frame({ len, camYaw: reducedRef.current ? 0 : cam, distance: len, wrong })

        // Signs ahead fade slowly into the horizon; ones behind us fade fast.
        const fade = (ahead) => (ahead >= 0
            ? clamp01(1 - Math.max(0, ahead - 0.2 * g.S) / (2.6 * g.S))
            : clamp01(1 + ahead / (0.55 * g.S)))

        const place = (el, wx, wz, lift, op, suffix) => {
            if (!el) return
            const pr = op > 0.01 ? world.project(wx, wz, lift) : null
            if (!pr) {
                el.style.visibility = 'hidden'
                return
            }
            el.style.visibility = 'visible'
            el.style.opacity = op.toFixed(3)
            el.style.zIndex = String(Math.round(pr.s * 100))
            el.style.transform =
                `translate(${pr.x.toFixed(1)}px, ${pr.y.toFixed(1)}px) scale(${pr.s.toFixed(4)})${suffix || ''}`
        }

        let active = -1
        let best = Infinity
        let reached = 0
        g.nodes.forEach((n, i) => {
            const ahead = ((((n.j - jmod) % g.P) + g.P + g.P / 2) % g.P) - g.P / 2
            if (n.j <= jmod + 2) reached += 1
            if (Math.abs(ahead) < best) {
                best = Math.abs(ahead)
                active = i
            }
            const op = fade(ahead)
            place(cardRefs.current[i], n.x, n.z, 0, op)
            place(dotRefs.current[i], n.x, n.z, 6, op)
        })
        if (best > g.S * 0.5) active = -1

        place(
            introRef.current,
            g.start.x - g.startDir.x * g.titleBack,
            g.start.z - g.startDir.z * g.titleBack,
            0,
            jm < 0 ? 1 : clamp01(1 - jm / (0.4 * g.S)),
            ' translate(-50%, -100%)'
        )

        const an = anim.current
        if (an.active !== active || an.reached !== reached) {
            an.active = active
            an.reached = reached
            setView({ active, reached })
        }
    }, [])

    const tick = useCallback((now) => {
        const a = anim.current
        const dt = Math.min(0.05, (now - a.last) / 1000) || 0.016
        a.last = now
        const k = reducedRef.current ? 1 : 1 - Math.exp(-dt * 7)
        a.current += (a.target - a.current) * k
        if (Math.abs(a.target - a.current) < 0.05) a.current = a.target
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

    // Build the 3D world once the page is up. If the browser can't (no WebGL,
    // model missing), fall back to the plain list.
    useEffect(() => {
        let dead = false
        let w = null
        if (!geo) return undefined
        loadWorld(canvasRef.current)
            .then((world) => {
                if (dead) {
                    world.dispose()
                    return
                }
                w = world
                worldRef.current = world
                const s = sizeRef.current
                const g = geoRef.current
                if (g) world.setSize(s.w, s.h, g.aX, g.aY)
                paint(anim.current.current)
            })
            .catch((err) => {
                console.warn('Work scene unavailable, showing the list instead.', err)
                if (!dead) onFail()
            })
        return () => {
            dead = true
            worldRef.current = null
            if (w) w.dispose()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!geo])

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

    // Whenever the geometry changes, rebuild the scroll-to-line mapping and repaint.
    useLayoutEffect(() => {
        const prevGeo = geoRef.current
        geoRef.current = geo
        sizeRef.current = size
        if (!geo) return
        // scroll distance -> distance along the line; the last knot is the finish line
        // scroll distance -> distance along the line, repeating every lap. Three laps
        // of knots keep the join between laps as smooth as everywhere else.
        const baseX = [0, ...geo.nodes.map((nd) => nd.j)]
        const baseY = [-PRE, ...geo.nodes.map((nd) => nd.len)]
        const kx = []
        const ky = []
        for (let lap = -1; lap <= 2; lap += 1) {
            baseX.forEach((x, i) => {
                kx.push(x + lap * geo.P)
                ky.push(baseY[i] + lap * TRACK.L)
            })
        }
        const toLen = monotone(kx, ky)
        tableRef.current = { toLen }
        if (worldRef.current) worldRef.current.setSize(size.w, size.h, geo.aX, geo.aY)

        const a = anim.current
        const frac = prevGeo ? a.target / prevGeo.P : 1
        a.target = frac * geo.P
        scrollerRef.current.scrollTop = a.target
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
        const el = scrollerRef.current
        const top = el.scrollTop
        // before the first lap there is only a short wrong-way run behind the start
        const floor = g.P - (WRONG_RUN / WRONG_SPEED) * g.S
        if (a.shift === 0 && top < floor) {
            el.scrollTop = floor
            a.target = floor
            kick()
            return
        }
        // endless: when the scroll position drifts toward either end, jump a whole
        // lap, which looks identical
        let shift = 0
        if (a.shift > 0 && top < 0.1 * g.P) shift = g.P
        else if (top > 2.9 * g.P) shift = -g.P
        if (shift) {
            el.scrollTop = top + shift
            a.current += shift
            a.target = top + shift
            a.shift -= Math.sign(shift)
        } else {
            a.target = top
        }
        kick()
    }

    // Keyboard: hold W / S to move forward / back; A / D (or the left / right
    // arrows) jump to the previous / next checkpoint. Everything goes through the
    // scroll position, so the camera, rail and cards respond exactly as they do to
    // the mouse wheel.
    useEffect(() => {
        const held = new Set()
        let raf = 0
        let last = 0
        let dest = null
        let destAt = 0

        const step = (now) => {
            const dt = Math.min(0.05, (now - last) / 1000) || 0.016
            last = now
            const dir = (held.has('w') ? 1 : 0) - (held.has('s') ? 1 : 0)
            const el = scrollerRef.current
            if (dir && el) {
                el.scrollTop += dir * KEY_SPEED * dt
                raf = requestAnimationFrame(step)
            } else {
                raf = 0
            }
        }

        const jump = (dir) => {
            const g = geoRef.current
            const el = scrollerRef.current
            if (!g || !el) return
            const now = performance.now()
            // pressing again mid-glide continues from where the last jump is heading
            const base = dest !== null && now - destAt < 900 ? dest : el.scrollTop
            const stops = [0, 1, 2]
                .flatMap((lap) => [0, ...g.nodes.map((n) => n.j)].map((j) => j + lap * g.P))
                .filter((t) => anim.current.shift > 0 || t >= g.P)
            const next = dir > 0
                ? stops.find((s) => s > base + 20)
                : [...stops].reverse().find((s) => s < base - 20)
            if (next === undefined) return
            dest = next
            destAt = now
            el.scrollTo({ top: next, behavior: reducedRef.current ? 'auto' : 'smooth' })
        }

        const onKeyDown = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return
            const t = e.target
            if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return
            const k = e.key.toLowerCase()
            if (k === 'w' || k === 's') {
                held.add(k)
                if (!raf) {
                    last = performance.now()
                    raf = requestAnimationFrame(step)
                }
            } else if (k === 'd' || k === 'arrowright') {
                if (!e.repeat) jump(1)
            } else if (k === 'a' || k === 'arrowleft') {
                if (!e.repeat) jump(-1)
            }
        }
        const onKeyUp = (e) => held.delete(e.key.toLowerCase())
        const onBlur = () => held.clear()

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        window.addEventListener('blur', onBlur)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            window.removeEventListener('blur', onBlur)
            cancelAnimationFrame(raf)
        }
    }, [])

    const goTo = (i) => {
        const g = geoRef.current
        if (!g) return
        // the nearest copy of this checkpoint, in whichever lap that is
        const here = scrollerRef.current.scrollTop
        const top = [0, 1, 2].map((lap) => g.nodes[i].j + lap * g.P)
            .filter((t) => anim.current.shift > 0 || t >= g.P)
            .reduce((best, t) => (Math.abs(t - here) < Math.abs(best - here) ? t : best))
        scrollerRef.current.scrollTo({
            top,
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
                    <div className="journey-track" style={{ height: size.h + 3 * geo.P }}>
                        <div className="journey-stage" style={{ height: size.h }}>
                            <canvas ref={canvasRef} className="journey-gl" aria-hidden="true" />

                            <div className="journey-cards">
                                <div
                                    className="wrong-way"
                                    ref={wrongRef}
                                    style={{ left: geo.aX + 72, top: geo.aY - 10 }}
                                >
                                    Wrong way!
                                </div>

                                <div className="journey-intro" ref={introRef}>
                                    <Title letterClass={letterClass} />
                                    <p className="hint">
                                        (Scroll Down)
                                    </p>
                                    <p className="track-name">Track: Laguna Seca</p>
                                </div>

                                {jobs.map((job, i) => {
                                    const n = geo.nodes[i]
                                    return (
                                        <div key={job.id}>
                                            <div
                                                className={[
                                                    'card-anchor',
                                                    'node-dot',
                                                    i < view.reached ? 'reached' : '',
                                                    view.active === i ? 'active' : '',
                                                ].join(' ')}
                                                ref={(el) => { dotRefs.current[i] = el }}
                                            >
                                                <span className="ring" />
                                                <span className="core" />
                                            </div>
                                            <div
                                                className="card-anchor"
                                                ref={(el) => { cardRefs.current[i] = el }}
                                            >
                                                <article
                                                    className={[
                                                        'job-card',
                                                        n.side < 0 ? 'on-left' : 'on-right',
                                                        view.active === i ? 'open' : '',
                                                    ].join(' ')}
                                                    style={{
                                                        left: n.side < 0 ? -(GAP + n.w) : GAP,
                                                        top: -OFFSET,
                                                        width: n.w,
                                                    }}
                                                >
                                                    <JobCard job={job} />
                                                </article>
                                            </div>
                                        </div>
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
    const [failed, setFailed] = useState(false)
    const [letterClass, setLetterClass] = useState('text-animate')

    useEffect(() => {
        const timerId = setTimeout(() => {
            setLetterClass('text-animate-hover')
        }, 3000)
        return () => clearTimeout(timerId)
    }, [])

    const flat = compact || failed
    return (
        <>
            <div className={`work-journey${flat ? ' compact' : ''}`}>
                {flat
                    ? <FlatList letterClass={letterClass} />
                    : <Journey letterClass={letterClass} onFail={() => setFailed(true)} />}
            </div>
            <PageLoader />
        </>
    )
}

export default Work
