import minecraft from '../../../data/minecraft.json'
import './index.scss'

// Layout slots for the collage: [columns, rows]. A photo takes the next slot, so the mix
// of big / wide / tall / small tiles stays the same however many photos there are.
const SLOTS = [
    [2, 2], [1, 2], [2, 2], [1, 2],
    [1, 1], [2, 1], [1, 2], [2, 1],
    [2, 1], [1, 1], [1, 1], [1, 1],
]

const MinecraftCollage = () => {
    const photos = minecraft.photos || []
    const count = Math.max(SLOTS.length, photos.length)
    const tiles = Array.from({ length: count }, (_, i) => ({
        photo: photos[i],
        slot: SLOTS[i % SLOTS.length],
    }))

    return (
        <section className="mc-section">
            <div className="construction-line" role="img" aria-label="Under construction" />
            <h2 className="mc-title">Minecraft Builds</h2>
            <p className="mc-sub">Under construction — more builds coming soon.</p>
            <div className="mc-grid">
                {tiles.map(({ photo, slot }, i) => (
                    <div
                        key={i}
                        className={`mc-tile${photo ? '' : ' empty'}`}
                        style={{ gridColumn: `span ${slot[0]}`, gridRow: `span ${slot[1]}` }}
                    >
                        {photo ? (
                            <img src={photo.src} alt={photo.alt || 'Minecraft build'} loading="lazy" />
                        ) : (
                            <span className="mc-num">{String(i + 1).padStart(2, '0')}</span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

export default MinecraftCollage
