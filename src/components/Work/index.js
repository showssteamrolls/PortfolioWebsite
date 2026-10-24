import './index.scss'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Loader from 'react-loaders'
import AnimatedLetters from '../AnimatedLetters'
import signature from '../../assets/images/signature.png'
import { loadCar, CAR_SIZE } from './car'
import workData from '../../data/work.json'
import track from '../../data/laguna.json'

const jobs = workData.jobs

const OFFSET = 8 // px a card sits above its checkpoint so its first line meets the connector
const GAP = 46 // px between a checkpoint and its card
const RAIL = 150 // px reserved on the right for the contents rail

// The path lies on a ground plane tilted away from the viewer. The camera
// flies along it, so checkpoints ahead are smaller and nearer the horizon.
const PERSPECTIVE = 1300
const TILT_DEG = 54
const TILT = (TILT_DEG * Math.PI) / 180
const SIN = Math.sin(TILT)
const COS = Math.cos(TILT)
const KEY_SPEED = 650 // scroll px per second while W / S is held

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

// The circuit is Laguna Seca, traced from a map (src/data/laguna.json). The
// journey starts on the start/finish line and stops at every other turn:
// 1, 3, 5, 7, 9 and 11. "j" is scroll distance: every stop gets the same amount
// of scrolling, however far apart the turns really are.
const K = 7 // ground px per map px: how big the circuit is
const MARGIN = 420 // room around the circuit for the signs
const CARD_W = 380

// Smooth curve through the traced points.
const smoothPath = (pts) => {
    const f = (v) => v.toFixed(1)
    let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`
    for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[Math.max(0, i - 1)]
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const p3 = pts[Math.min(pts.length - 1, i + 2)]
        d += ` C ${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)},`
            + ` ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)}, ${f(p2.x)} ${f(p2.y)}`
    }
    return d
}

const buildGeometry = (w, h, n) => {
    const contentW = w - RAIL
    const S = Math.max(420, h * 0.68)
    const aX = contentW / 2
    const aY = Math.min(Math.max(h - 520, h * 0.34), h * 0.56) // leaves room under the open card
    const cardW = Math.max(200, Math.min(CARD_W, aX - GAP - 30))

    const pts = track.points.map(([x, y]) => ({ x: x * K + MARGIN, y: y * K + MARGIN }))
    const nodes = track.stops.slice(0, n).map((si, i) => {
        const p = pts[si]
        const before = pts[Math.max(0, si - 4)]
        const after = pts[Math.min(pts.length - 1, si + 4)]
        const turn = (p.x - before.x) * (after.y - p.y) - (p.y - before.y) * (after.x - p.x)
        // the card goes on the outside of the turn, away from where the line is heading
        return { x: p.x, y: p.y, w: cardW, j: S * (i + 1), side: turn > 0 ? -1 : 1 }
    })

    const dx = pts[4].x - pts[0].x
    const dy = pts[4].y - pts[0].y
    const dl = Math.hypot(dx, dy) || 1

    return {
        contentW, S, D: S * n, aX, aY, nodes,
        d: smoothPath(pts),
        worldW: track.w * K + MARGIN * 2,
        worldH: track.h * K + MARGIN * 2,
        start: pts[0],
        startDir: { x: dx / dl, y: dy / dl },
        titleBack: S * 0.45, // the title stands behind the start line, so the path never crosses it
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

// Where the car is, and which way the camera and car face, at scroll distance j.
// Angles are clockwise from straight up the page.
const sample = (t, j) => {
    const s = Math.min(t.maxLen, Math.max(0, t.toLen(j)))
    let lo = 0
    let hi = t.count
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (t.ls[mid] <= s) lo = mid
        else hi = mid
    }
    const span = t.ls[hi] - t.ls[lo] || 1
    const f = clamp01((s - t.ls[lo]) / span)
    const mix = (arr) => arr[lo] + (arr[hi] - arr[lo]) * f
    return { x: mix(t.xs), y: mix(t.ys), len: s, cam: mix(t.cam), tru: mix(t.tru) }
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
            <span className="job-dates">{job.dates}</span>
            <div className="job-head">
                <JobLogo job={job} />
                <div className="job-titles">
                    <h2 className="job-company">{job.company}</h2>
                    <p className="job-role">
                        <span className="role-line">{job.title}</span>
                        {job.subtitle ? <span className="role-line">{job.subtitle}</span> : null}
                    </p>
                </div>
            </div>
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
    const worldRef = useRef(null)
    const introRef = useRef(null)
    const trackPathRef = useRef(null)
    const progRef = useRef(null)
    const markerRef = useRef(null)
    const carCanvasRef = useRef(null)
    const carRef = useRef(null)
    const [hasCar, setHasCar] = useState(false)
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

    // Move the camera along the path for a given progress (0 to 1): turn and
    // slide the ground under a fixed viewpoint, then place each sign where the
    // same perspective puts its checkpoint. Runs every frame, so it writes
    // straight to the DOM.
    const paint = useCallback((p) => {
        const g = geoRef.current
        const t = tableRef.current
        if (!g || !t) return

        const jm = p * g.D
        const { x: mx, y: myF, len, cam, tru } = sample(t, jm)
        const a = reducedRef.current ? 0 : -cam // the camera turns with the car
        const cosA = Math.cos(a)
        const sinA = Math.sin(a)

        worldRef.current.style.transform =
            `translate(${g.aX}px, ${g.aY}px) rotate(${a}rad) translate(${-mx}px, ${-myF}px)`
        markerRef.current.setAttribute('transform', `translate(${mx.toFixed(2)} ${myF.toFixed(2)})`)
        t.segs.forEach((sg) => {
            const shown = Math.min(sg.len, Math.max(0, len - sg.start))
            const off = String(sg.len - shown)
            const vis = shown > 0.5 ? 'visible' : 'hidden'
            sg.els.forEach((el) => {
                el.style.strokeDashoffset = off
                el.style.visibility = vis
            })
        })
        anim.current.heading = tru + a // which way the car points on screen
        anim.current.dist = len
        if (carRef.current) carRef.current.update(anim.current.heading, len)

        // Same maths the browser uses for the tilted ground, so signs line up with it.
        const project = (wx, wy) => {
            const dx = wx - mx
            const dy = wy - myF
            const vx = dx * cosA - dy * sinA
            const vy = dx * sinA + dy * cosA
            const denom = PERSPECTIVE - vy * SIN
            if (denom < 0.15 * PERSPECTIVE) return null
            const s = PERSPECTIVE / denom
            return { x: g.aX + vx * s, y: g.aY + vy * COS * s, s }
        }

        // Signs ahead fade slowly into the horizon; ones behind us fade fast.
        const fade = (ahead) => (ahead >= 0
            ? clamp01(1 - Math.max(0, ahead - 0.2 * g.S) / (2.6 * g.S))
            : clamp01(1 + ahead / (0.55 * g.S)))

        const place = (el, wx, wy, op, suffix) => {
            if (!el) return
            const pr = op > 0.01 ? project(wx, wy) : null
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
            const ahead = n.j - jm
            if (n.j <= jm + 2) reached += 1
            if (Math.abs(ahead) < best) {
                best = Math.abs(ahead)
                active = i
            }
            place(cardRefs.current[i], n.x, n.y, fade(ahead))
        })
        if (best > g.S * 0.5) active = -1

        place(
            introRef.current,
            g.start.x - g.startDir.x * g.titleBack,
            g.start.y - g.startDir.y * g.titleBack,
            clamp01(1 - jm / (0.4 * g.S)),
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

    // Bring in the race car once the page is up; keep the dot if it can't load.
    useEffect(() => {
        let dead = false
        let car = null
        if (!geo || !carCanvasRef.current) return undefined
        loadCar(carCanvasRef.current, CAR_SIZE)
            .then((c) => {
                if (dead) {
                    c.dispose()
                    return
                }
                car = c
                carRef.current = c
                c.update(anim.current.heading || 0, anim.current.dist || 0)
                setHasCar(true)
            })
            .catch(() => {})
        return () => {
            dead = true
            carRef.current = null
            if (car) car.dispose()
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

    // Whenever the geometry changes, re-measure the line and repaint.
    useLayoutEffect(() => {
        geoRef.current = geo
        sizeRef.current = size
        const path = trackPathRef.current
        if (!geo || !path) return

        const L = path.getTotalLength()
        const step = 4
        const count = Math.ceil(L / step)
        const xs = new Float64Array(count + 1)
        const ys = new Float64Array(count + 1)
        const ls = new Float64Array(count + 1)
        for (let k = 0; k <= count; k += 1) {
            const len = Math.min(k * step, L)
            const pt = path.getPointAtLength(len)
            xs[k] = pt.x
            ys[k] = pt.y
            ls[k] = len
        }

        // which way the line points at each sample (unwrapped so turns can pass 180deg)
        const tru = new Float64Array(count + 1)
        for (let k = 0; k <= count; k += 1) {
            const lo = Math.max(0, k - 3)
            const hi = Math.min(count, k + 3)
            tru[k] = Math.atan2(xs[hi] - xs[lo], -(ys[hi] - ys[lo]))
            if (k > 0) {
                while (tru[k] - tru[k - 1] > Math.PI) tru[k] -= 2 * Math.PI
                while (tru[k] - tru[k - 1] < -Math.PI) tru[k] += 2 * Math.PI
            }
        }
        // the camera looks a little ahead and eases through bends
        const pre = new Float64Array(count + 2)
        for (let k = 0; k <= count; k += 1) pre[k + 1] = pre[k] + tru[k]
        const cam = new Float64Array(count + 1)
        for (let k = 0; k <= count; k += 1) {
            const lo = Math.max(0, k - 15)
            const hi = Math.min(count, k + 45)
            cam[k] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1)
        }

        // distance along the line at each stop, then the scroll-to-line mapping
        const stopLen = geo.nodes.map((nd) => {
            let best = 0
            let bd = Infinity
            for (let k = 0; k <= count; k += 1) {
                const d2 = (xs[k] - nd.x) ** 2 + (ys[k] - nd.y) ** 2
                if (d2 < bd) {
                    bd = d2
                    best = k
                }
            }
            return ls[best]
        })
        const toLen = monotone([0, ...geo.nodes.map((nd) => nd.j)], [0, ...stopLen])

        // the lit line behind the car, in short pieces so the colour can shift along it
        const pg = progRef.current
        while (pg.firstChild) pg.removeChild(pg.firstChild)
        const ns = 'http://www.w3.org/2000/svg'
        const lastStop = stopLen[stopLen.length - 1]
        const pieces = 40
        const segs = []
        const from = [0, 180, 216]
        const to = [39, 93, 250]
        for (let i = 0; i < pieces; i += 1) {
            const start = (lastStop * i) / pieces
            const end = (lastStop * (i + 1)) / pieces
            const k0 = Math.floor(start / step)
            const k1 = Math.min(count, Math.ceil(end / step))
            let d = ''
            let len = 0
            for (let k = k0; k <= k1; k += 1) {
                d += `${k === k0 ? 'M' : 'L'} ${xs[k].toFixed(1)} ${ys[k].toFixed(1)} `
                if (k > k0) len += Math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1])
            }
            const f = (i + 0.5) / pieces
            const color = `rgb(${from.map((c, q) => Math.round(c + (to[q] - c) * f)).join(',')})`
            const els = ['glow', 'progress'].map((cls) => {
                const el = document.createElementNS(ns, 'path')
                el.setAttribute('class', cls)
                el.setAttribute('d', d)
                el.setAttribute('stroke', color)
                el.style.strokeDasharray = String(len + 1)
                pg.appendChild(el)
                return el
            })
            segs.push({ start, len: len + 1, els })
        }
        tableRef.current = { L, xs, ys, ls, tru, cam, count, maxLen: L, toLen, segs }

        const a = anim.current
        scrollerRef.current.scrollTop = a.target * geo.D
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
        a.target = clamp01(scrollerRef.current.scrollTop / g.D)
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
            const stops = [0, ...g.nodes.map((n) => n.j)]
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
        scrollerRef.current.scrollTo({
            top: g.nodes[i].j,
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
                    <div className="journey-track" style={{ height: size.h + geo.D }}>
                        <div
                            className={`journey-stage${hasCar ? ' has-car' : ''}`}
                            style={{
                                height: size.h,
                                perspective: `${PERSPECTIVE}px`,
                                perspectiveOrigin: `${geo.aX}px ${geo.aY}px`,
                            }}
                        >
                            <div
                                className="journey-plane"
                                style={{
                                    width: geo.contentW,
                                    height: size.h,
                                    transformOrigin: `${geo.aX}px ${geo.aY}px`,
                                    transform: `rotateX(${TILT_DEG}deg)`,
                                }}
                            >
                                <div
                                    className="journey-world"
                                    ref={worldRef}
                                    style={{ width: geo.worldW, height: geo.worldH }}
                                >
                                    <svg
                                        className="journey-svg"
                                        width={geo.worldW}
                                        height={geo.worldH}
                                        viewBox={`0 0 ${geo.worldW} ${geo.worldH}`}
                                        aria-hidden="true"
                                    >
                                        <path ref={trackPathRef} className="track" d={geo.d} />
                                        <g ref={progRef} />
                                        <circle className="origin" cx={geo.start.x} cy={geo.start.y} r="5" />
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
                                                <circle className="ring" r="22" />
                                                <circle className="core" r="8" />
                                            </g>
                                        ))}
                                        <g ref={markerRef} className="marker">
                                            <circle className="halo" r="22" />
                                            <circle className="dot" r="7" />
                                        </g>
                                    </svg>
                                </div>
                            </div>

                            <div className="journey-cards">
                                <div className="journey-intro" ref={introRef}>
                                    <Title letterClass={letterClass} />
                                    <p className="hint">
                                        (Scroll Down)
                                    </p>
                                    <p className="track-name">Track: Laguna Seca</p>
                                    <img className="signature" src={signature} alt="Anthony's signature" />
                                </div>

                                {jobs.map((job, i) => {
                                    const n = geo.nodes[i]
                                    return (
                                        <div
                                            key={job.id}
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
                                    )
                                })}
                            </div>

                            <canvas
                                ref={carCanvasRef}
                                className="journey-car"
                                aria-hidden="true"
                                style={{ left: geo.aX - CAR_SIZE / 2, top: geo.aY - CAR_SIZE / 2 }}
                            />
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
