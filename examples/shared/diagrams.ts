// Sample diagrams shared by the React and Svelte examples.
export const diagrams: Record<string, string> = {
  'Flowchart': `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Ship it]
    B -->|No| D[Debug]
    D --> E[Fix bug]
    E --> B
    C --> F((Done))
    subgraph Release
      C
      F
    end`,
  'Architecture (LR)': `flowchart LR
    client[Client] -->|HTTPS| api[API Gateway]
    api --> auth[Auth]
    api --> orders[Orders]
    orders --> db[(Postgres)]
    orders -.-> queue[[Queue]]
    queue --> worker[Worker]
    worker --> db`,
  'Sequence': `sequenceDiagram
    participant U as User
    participant A as App
    participant S as Server
    U->>A: Click login
    A->>S: POST /login
    S-->>A: 200 OK + token
    A-->>U: Show dashboard`,
  'State': `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch
    Loading --> Success: ok
    Loading --> Error: fail
    Error --> Loading: retry
    Success --> [*]`,
};
