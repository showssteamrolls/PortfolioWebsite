import { useEffect, useRef, useState } from 'react'
import './index.scss'

const DEAD = 0.14 // cursor this close to the middle of the page leaves the ring still (it settles on a card)
const VMAX = 1.7 // fastest spin, radians per second
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// The projects sit on a small tilted ring. The cursor's position steers the spin
// (left/right of centre = faster), and it settles with one card at the front.
const PortfolioRing = ({ items }) => {
    const stageRef = useRef(null)
    const itemRefs = useRef([])
    const [dims, setDims] = useState({ rx: 320, ry: 90, c: 250 })
    const dimsRef = useRef(dims)
    const n = items.length

    useEffect(() => {
        const el = stageRef.current
        const measure = () => {
            const w = el.clientWidth
            const c = clamp(w * 0.27, 190, 270)
            const next = { rx: clamp(w * 0.33, 170, 380), ry: clamp(c * 0.36, 60, 100), c }
            dimsRef.current = next
            setDims(next)
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        const step = (Math.PI * 2) / n
        const s = { angle: 0, v: 0, off: 0, k: null, last: performance.now(), raf: 0 }

        const onMove = (e) => {
            s.off = clamp((e.clientX - window.innerWidth / 2) / (window.innerWidth * 0.4), -1, 1)
            if (Math.abs(s.off) > DEAD) s.k = null
        }
        const onLeave = () => { s.off = 0 }
        const onKey = (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            s.k = Math.round(s.angle / step) + (e.key === 'ArrowRight' ? 1 : -1)
        }
        window.addEventListener('pointermove', onMove)
        document.addEventListener('pointerleave', onLeave)
        window.addEventListener('keydown', onKey)

        const tick = (now) => {
            const dt = Math.min(0.05, (now - s.last) / 1000)
            s.last = now
            const o = Math.abs(s.off)
            const vt = o < DEAD ? 0 : Math.sign(s.off) * ((o - DEAD) / (1 - DEAD)) * VMAX
            s.v += (vt - s.v) * Math.min(1, dt * 5)
            s.angle += s.v * dt
            if (vt === 0 && Math.abs(s.v) < 0.35) {
                const goal = (s.k !== null ? s.k : Math.round(s.angle / step)) * step
                s.angle += (goal - s.angle) * Math.min(1, dt * 4)
            }

            const { rx, ry, c } = dimsRef.current
            for (let i = 0; i < n; i += 1) {
                const el = itemRefs.current[i]
                if (!el) continue
                const th = s.angle + i * step
                const cos = Math.cos(th)
                const d = (cos + 1) / 2 // 1 at the front, 0 at the back
                const sc = 0.5 + 0.5 * d
                el.style.transform =
                    `translate3d(${(rx * Math.sin(th)).toFixed(1)}px, ${(ry * cos).toFixed(1)}px, 0) scale(${sc.toFixed(3)})`
                el.style.zIndex = String(Math.round(d * 100))
                el.style.opacity = (0.5 + 0.5 * d).toFixed(3)
                el.style.setProperty('--text', clamp((d - 0.35) / 0.4, 0, 1).toFixed(3))
                el.style.width = `${c}px`
                el.style.height = `${c}px`
                el.style.marginLeft = `${-c / 2}px`
                el.style.marginTop = `${-c / 2}px`
            }
            s.raf = requestAnimationFrame(tick)
        }
        s.raf = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(s.raf)
            window.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerleave', onLeave)
            window.removeEventListener('keydown', onKey)
        }
    }, [n])

    return (
        <div className="ring-wrap">
            <div className="ring-stage" ref={stageRef} style={{ height: dims.c + dims.ry * 2 + 40 }}>
                <div className="ring-path wide" style={{ width: dims.rx * 2, height: dims.ry * 2 }} />
                <div className="ring-path thin" style={{ width: dims.rx * 2, height: dims.ry * 2 }} />
                {items.map((port, i) => {
                    const Tag = port.url ? 'a' : 'div'
                    const link = port.url ? { href: port.url, target: '_blank', rel: 'noreferrer' } : {}
                    return (
                        <Tag
                            key={port.cover}
                            className={`ring-item${port.url ? ' linked' : ''}`}
                            ref={(el) => { itemRefs.current[i] = el }}
                            aria-label={port.title || 'Coming soon'}
                            {...link}
                        >
                            <img src={port.cover} alt="" draggable="false" />
                            {(port.title || port.description) && (
                                <div className="ring-text">
                                    <p className="title">{port.title}</p>
                                    <p className="description">{port.description}</p>
                                </div>
                            )}
                        </Tag>
                    )
                })}
            </div>
            <p className="ring-hint">Move your cursor to spin · click a project to open it</p>
        </div>
    )
}

export default PortfolioRing
