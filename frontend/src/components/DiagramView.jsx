// Draws a diagram that the backend has already validated.
// diagram = { type: "flowchart" | "conceptmap", title, center?, items: [{ label, detail }] }

function Flowchart({ items }) {
  return (
    <ol className="flow">
      {items.map((item, i) => (
        <li className="flow-step" key={i}>
          <div className="flow-node">
            <span className="flow-num">{i + 1}</span>
            <div className="flow-text">
              <p className="flow-label">{item.label}</p>
              {item.detail && <p className="flow-detail">{item.detail}</p>}
            </div>
          </div>
          {i < items.length - 1 && (
            <span className="flow-arrow" aria-hidden="true">
              ↓
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Branch({ item }) {
  return (
    <div className="map-branch">
      <p className="map-label">{item.label}</p>
      {item.detail && <p className="map-detail">{item.detail}</p>}
    </div>
  );
}

function ConceptMap({ center, items }) {
  // Half of the branches go on the left of the centre, the rest on the right
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);

  return (
    <div className="map">
      <div className="map-center">
        <span>{center}</span>
      </div>
      <div className="map-col map-left">
        {left.map((item, i) => (
          <Branch item={item} key={i} />
        ))}
      </div>
      <div className="map-col map-right">
        {right.map((item, i) => (
          <Branch item={item} key={i} />
        ))}
      </div>
    </div>
  );
}

function DiagramView({ diagram }) {
  const isFlow = diagram.type === "flowchart";

  return (
    <figure className="diagram">
      <figcaption className="diagram-head">
        <span className="diagram-badge">{isFlow ? "Flowchart" : "Concept map"}</span>
        <span className="diagram-title">{diagram.title}</span>
      </figcaption>

      {isFlow ? (
        <Flowchart items={diagram.items} />
      ) : (
        <ConceptMap center={diagram.center} items={diagram.items} />
      )}
    </figure>
  );
}

export default DiagramView;