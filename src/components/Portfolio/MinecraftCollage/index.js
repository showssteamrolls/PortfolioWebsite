import minecraft from '../../../data/minecraft.json'
import './index.scss'

// One block of 12 tiles, fitted together with no gaps on a 12-column x 10-row grid.
// [column start, column end, row start, row end] (end lines are exclusive). Tiles
// of different widths share the same columns, so no straight vertical seams run through.
const BLOCK = [
    [1, 6, 1, 5], [1, 3, 5, 9], [1, 3, 9, 11], [3, 6, 5, 8],
    [3, 6, 8, 11], [6, 10, 1, 4], [6, 10, 4, 8], [6, 10, 8, 11],
    [10, 13, 1, 3], [10, 13, 3, 6], [10, 13, 6, 9], [10, 13, 9, 11],
]

const MinecraftCollage = () => {
    const photos = minecraft.photos || []
    const count = Math.max(BLOCK.length, photos.length)
    const blocks = []
    for (let i = 0; i < count; i += BLOCK.length) {
        blocks.push(
            Array.from({ length: Math.min(BLOCK.length, count - i) }, (_, j) => ({
                n: i + j,
                photo: photos[i + j],
                area: BLOCK[j],
            }))
        )
    }

    return (
        <section className="mc-section">
            <div className="construction-line" role="img" aria-label="Under construction" />
            <h2 className="mc-title">Minecraft Builds</h2>
            <p className="mc-sub">Work In Progress</p>
            {blocks.map((tiles, bi) => (
                <div className="mc-grid" key={bi}>
                    {tiles.map(({ n, photo, area }) => (
                        <div
                            key={n}
                            className={`mc-tile${photo ? '' : ' empty'}`}
                            style={{ gridColumn: `${area[0]} / ${area[1]}`, gridRow: `${area[2]} / ${area[3]}` }}
                        >
                            {photo ? (
                                <img src={photo.src} alt={photo.alt || 'Minecraft build'} loading="lazy" />
                            ) : (
                                <span className="mc-num">{String(n + 1).padStart(2, '0')}</span>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </section>
    )
}

export default MinecraftCollage
