// All case-study content lives here as data; pages render from it.
// Every `results` figure must be one you can substantiate — never add an
// invented number. A study carrying only one verified figure is correct.
export const caseStudies = [
  {
    slug: 'payments-licensing',
    kicker: 'XSplit · SplitmediaLabs',
    title: 'Payment & licensing infrastructure for a global desktop product',
    summary:
      'Multiple gateways, subscriptions, and license enforcement across web and desktop — with zero-downtime migrations.',
    outcome:
      'Multiple payment gateways and a licensing system serving a worldwide user base — extended and migrated with zero downtime.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: '2014 – 2025',
      stack: 'Node.js · PHP · MySQL · Redis',
    },
    problem: [
      'XSplit sold subscriptions and licenses globally, which meant supporting multiple payment providers, currencies, and tax regimes — on top of a licensing system that desktop clients verified against continuously.',
      'The original implementation was tightly coupled to a single gateway inside a legacy PHP codebase. Adding a provider or changing a plan meant touching checkout logic directly, and any downtime hit the revenue path.',
    ],
    decisions: [
      {
        title: 'Gateway abstraction layer instead of per-provider code paths',
        why: 'A single provider interface let new gateways ship without touching checkout or licensing logic.',
        rejected:
          'Direct integrations per gateway — faster for the first provider, unmaintainable by the third.',
      },
      {
        title: 'License verification cached out of the database hot path',
        why: 'Desktop clients verify continuously; caching verification at the API edge kept the database off the hot path.',
        rejected: 'Per-check database reads — simple, but collapses under fleet-wide load.',
      },
      {
        title: 'Incremental billing migration behind stable API contracts',
        why: 'Old PHP and new Node.js code served the same API surface during cutover, so clients never noticed the migration.',
        rejected: 'Big-bang rewrite of billing — unbounded risk on the revenue path.',
      },
    ],
    results: [
      { value: 'Zero', label: 'downtime during migrations' },
    ],
    tags: ['Node.js', 'Payments', 'Licensing', 'MySQL', 'Redis'],
    diagram: {
      title: 'Payments and licensing architecture',
      width: 640,
      height: 220,
      nodes: [
        { id: 'clients', x: 20, y: 85, w: 120, h: 50, label: 'Desktop + web', sub: 'checkout' },
        { id: 'api', x: 210, y: 85, w: 130, h: 50, label: 'Payments API', sub: 'Node.js', accent: true },
        { id: 'gwA', x: 420, y: 20, w: 140, h: 44, label: 'Gateway A' },
        { id: 'gwB', x: 420, y: 88, w: 140, h: 44, label: 'Gateway B' },
        { id: 'lic', x: 420, y: 156, w: 140, h: 44, label: 'License store' },
      ],
      edges: [
        { from: 'clients', to: 'api' },
        { from: 'api', to: 'gwA' },
        { from: 'api', to: 'gwB' },
        { from: 'api', to: 'lic' },
      ],
    },
  },
  {
    slug: 'auth-at-scale',
    kicker: 'XSplit · SplitmediaLabs',
    title: 'Authentication for desktop and web at global scale',
    summary:
      'One identity system serving desktop apps, web properties, and third-party OAuth — built for global usage.',
    outcome:
      'A single identity system serving desktop apps, web properties, and third-party OAuth logins for users worldwide.',
    featured: true,
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: '2014 – 2025',
      stack: 'Node.js · Redis · MySQL · OAuth',
    },
    problem: [
      'Several products — desktop applications and multiple web properties — needed one account system, but desktop token lifecycles behave nothing like browser sessions.',
      'Third-party OAuth logins had to resolve to the same canonical identity as email accounts, and a failure anywhere locked users out of software they had paid for.',
    ],
    decisions: [
      {
        title: 'Token model split by client type',
        why: 'Long-lived refresh tokens for desktop clients and short browser sessions, issued by one service, matched each platform’s real lifecycle.',
        rejected: 'A one-size-fits-all session model — either insecure on web or hostile on desktop.',
      },
      {
        title: 'Third-party identities linked to one canonical account',
        why: 'OAuth logins attach to a single identity, so purchases and licenses always resolve to the same user.',
        rejected: 'Provider-keyed accounts — duplicate users and orphaned purchases.',
      },
      {
        title: 'Sessions in Redis, identities in MySQL',
        why: 'Hot-path token validation stays in memory while the durable identity record stays relational.',
        rejected: 'Database-backed sessions — hot-path load on the source of truth.',
      },
    ],
    results: [
      { value: 'Zero', label: 'forced global logouts during migrations' },
    ],
    tags: ['Auth', 'OAuth', 'Node.js', 'Redis', 'MySQL'],
    diagram: {
      title: 'Authentication architecture',
      width: 640,
      height: 232,
      nodes: [
        { id: 'desktop', x: 20, y: 20, w: 130, h: 44, label: 'Desktop apps' },
        { id: 'web', x: 20, y: 94, w: 130, h: 44, label: 'Web apps' },
        { id: 'oauth', x: 20, y: 168, w: 130, h: 44, label: 'OAuth providers' },
        { id: 'api', x: 250, y: 94, w: 140, h: 50, label: 'Auth API', sub: 'Node.js', accent: true },
        { id: 'redis', x: 470, y: 58, w: 140, h: 44, label: 'Redis', sub: 'sessions' },
        { id: 'mysql', x: 470, y: 132, w: 140, h: 44, label: 'MySQL', sub: 'identities' },
      ],
      edges: [
        { from: 'desktop', to: 'api' },
        { from: 'web', to: 'api' },
        { from: 'oauth', to: 'api' },
        { from: 'api', to: 'redis' },
        { from: 'api', to: 'mysql' },
      ],
    },
  },
  {
    slug: 'php-to-node',
    kicker: 'Migration',
    title: 'Migrating a legacy PHP platform to Node.js — incrementally, under load',
    summary:
      'Modernizing a revenue-critical PHP codebase to Node.js services without stopping the product.',
    outcome:
      'A revenue-critical PHP codebase modernized into Node.js services without stopping the product or freezing features.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: 'Multi-year, incremental',
      stack: 'PHP · Node.js · MySQL · Docker',
    },
    problem: [
      'Years of accumulated PHP handled authentication, billing, and licensing. It was hard to test, risky to deploy, and increasingly hard to hire for.',
      'A from-scratch rewrite was repeatedly considered and rejected — the product had to keep shipping features while the platform underneath it was replaced.',
    ],
    decisions: [
      {
        title: 'Strangler-fig routing at the proxy layer',
        why: 'A routing layer in front of the platform moved traffic endpoint-by-endpoint to new Node.js services, keeping every step reversible.',
        rejected: 'Big-bang rewrite — the industry’s best-documented way to lose two years.',
      },
      {
        title: 'Shared database during the transition',
        why: 'Old and new code read the same MySQL schema, with contracts enforced at the API layer — no dual-write machinery until services stabilized.',
        rejected: 'Splitting the database first — dual-write complexity before any service existed.',
      },
      {
        title: 'Behavior-preserving ports before redesigns',
        why: 'Endpoints were ported as-is and verified against existing behavior, then refactored — migration risk and design risk never in the same change.',
        rejected: 'Redesigning while porting — two failure modes in every deploy.',
      },
    ],
    results: [
      { value: 'Zero', label: 'revenue-impacting incidents during cutover' },
    ],
    tags: ['PHP', 'Node.js', 'Strangler fig', 'MySQL', 'Docker'],
    diagram: {
      title: 'Strangler-fig migration architecture',
      width: 640,
      height: 232,
      nodes: [
        { id: 'clients', x: 20, y: 94, w: 120, h: 44, label: 'Clients' },
        { id: 'proxy', x: 200, y: 91, w: 130, h: 50, label: 'Routing proxy', sub: 'strangler fig', accent: true },
        { id: 'php', x: 410, y: 20, w: 150, h: 50, label: 'Legacy PHP', sub: 'shrinking' },
        { id: 'node', x: 410, y: 92, w: 150, h: 50, label: 'Node services', sub: 'growing' },
        { id: 'db', x: 410, y: 172, w: 150, h: 40, label: 'Shared MySQL' },
      ],
      edges: [
        { from: 'clients', to: 'proxy' },
        { from: 'proxy', to: 'php' },
        { from: 'proxy', to: 'node' },
        { from: 'node', to: 'db' },
      ],
    },
  },
  {
    slug: 'monolith-to-events',
    kicker: 'XSplit · Architecture',
    title: 'From backend monolith to event-driven services',
    summary:
      'Splitting a backend monolith into event-driven services — queues, contracts, and the seams that made it safe.',
    outcome:
      'A backend monolith decomposed into event-driven services, with licensing, payment, and account events flowing through a message broker instead of cross-module calls.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: '2014 – 2025',
      stack: 'Node.js · RabbitMQ · Docker · MySQL',
    },
    problem: [
      'Backend modules were coupled through direct calls and shared tables: a slow payment provider could stall unrelated requests, and scaling one workload meant scaling everything.',
      'Deploys were all-or-nothing — every change carried the whole backend’s risk.',
    ],
    decisions: [
      {
        title: 'Events for cross-domain effects, not synchronous calls',
        why: 'License issuance reacts to a payment event through the broker, so provider latency is absorbed by the queue instead of blocking requests.',
        rejected: 'Synchronous service chains — a distributed monolith with network faults added.',
      },
      {
        title: 'Service boundaries along business capabilities',
        why: 'Payments, accounts, and licensing each own their domain and data — boundaries match how the product actually changes.',
        rejected: 'Layer-based services (API / logic / data tiers) — every feature touches every service.',
      },
      {
        title: 'Idempotent consumers with at-least-once delivery',
        why: 'Every consumer tolerates duplicate events by design, which makes broker semantics simple and failure recovery boring.',
        rejected: 'Exactly-once delivery assumptions — a guarantee brokers can’t actually make.',
      },
    ],
    results: [
      { value: 'Independent', label: 'deploys per service' },
    ],
    tags: ['RabbitMQ', 'Microservices', 'Node.js', 'Docker'],
    diagram: {
      title: 'Event-driven services architecture',
      width: 700,
      height: 240,
      nodes: [
        { id: 'gw', x: 20, y: 95, w: 120, h: 50, label: 'API gateway' },
        { id: 'pay', x: 200, y: 40, w: 140, h: 48, label: 'Payments svc' },
        { id: 'acct', x: 200, y: 150, w: 140, h: 48, label: 'Accounts svc' },
        { id: 'mq', x: 400, y: 95, w: 110, h: 50, label: 'RabbitMQ', accent: true },
        { id: 'lic', x: 560, y: 40, w: 120, h: 48, label: 'Licensing', sub: 'worker' },
        { id: 'wrk', x: 560, y: 150, w: 120, h: 48, label: 'Workers', sub: 'email, sync' },
      ],
      edges: [
        { from: 'gw', to: 'pay' },
        { from: 'gw', to: 'acct' },
        { from: 'pay', to: 'mq' },
        { from: 'acct', to: 'mq' },
        { from: 'mq', to: 'lic' },
        { from: 'mq', to: 'wrk' },
      ],
    },
  },
  {
    slug: 'cda-infrastructure',
    kicker: 'Cooperative Development Authority',
    title: 'Nationwide infrastructure and CI/CD for a government agency',
    summary:
      'Fourteen years of distributed infrastructure, deployment pipelines, and long-horizon architecture stewardship.',
    outcome:
      'Fourteen years of infrastructure stewardship — regional systems, deployment pipelines, and architecture for a nationwide agency.',
    context: {
      company: 'Cooperative Development Authority',
      role: 'Technical Consultant',
      timeframe: '2010 – 2024',
      stack: 'CI/CD · Docker · Linux · Cloud',
    },
    problem: [
      'A government agency serving cooperatives across the country ran systems in distributed offices with uneven connectivity and manual deployment practices.',
      'The systems had to outlive individual projects, vendors, and administrations — architecture decisions carried a ten-year-plus horizon.',
    ],
    decisions: [
      {
        title: 'One standardized deployment pipeline across systems',
        why: 'Every system ships through the same CI/CD path, so operational knowledge transfers instead of living with one person.',
        rejected: 'Per-system manual deploy procedures — unauditable and person-dependent.',
      },
      {
        title: 'Containerized services for hosting portability',
        why: 'Docker images run identically across hosting environments, surviving infrastructure changes the agency didn’t control.',
        rejected: 'Environment-specific installs — every hosting change becomes a migration project.',
      },
      {
        title: 'Boring-technology bias for a decade-long horizon',
        why: 'Mature, widely-known tools keep systems maintainable by whoever comes next.',
        rejected: 'Framework-of-the-year adoption — unmaintainable within one staffing cycle.',
      },
    ],
    results: [
      { value: '14 years', label: 'of continuous operation' },
    ],
    tags: ['CI/CD', 'Docker', 'Infrastructure', 'Linux'],
    diagram: {
      title: 'Nationwide deployment architecture',
      width: 640,
      height: 220,
      nodes: [
        { id: 'repo', x: 20, y: 88, w: 120, h: 44, label: 'Git repos' },
        { id: 'ci', x: 200, y: 85, w: 140, h: 50, label: 'CI/CD pipeline', accent: true },
        { id: 'central', x: 410, y: 20, w: 150, h: 48, label: 'Central services' },
        { id: 'regional', x: 410, y: 92, w: 150, h: 48, label: 'Regional systems' },
        { id: 'offices', x: 410, y: 168, w: 150, h: 40, label: 'Field offices' },
      ],
      edges: [
        { from: 'repo', to: 'ci' },
        { from: 'ci', to: 'central' },
        { from: 'ci', to: 'regional' },
        { from: 'regional', to: 'offices' },
      ],
    },
  },
  {
    slug: 'bloomgate',
    kicker: 'Bloomgate · Own product',
    title: 'Un-distributing a SaaS: five services back into one',
    summary:
      'A product built as microservices, then deliberately consolidated — broker removed, cluster decommissioned, nothing lost.',
    outcome:
      'Five deployables over a message broker on Kubernetes, consolidated into a single backend on one droplet — with the broker, the managed cluster, and the managed database all decommissioned after a rehearsed cutover.',
    link: 'https://bloomgate.app',
    context: {
      company: 'Bloomgate (independent product)',
      role: 'Founder & sole engineer',
      timeframe: 'Jun 2026 – present',
      stack: 'Node.js · TypeScript · Prisma · PostgreSQL · pg-boss',
    },
    problem: [
      'Bloomgate is a Telegram channel-management SaaS I build and run alone. It started with an architecture sized for a team: five deployables talking over RabbitMQ, a managed Kubernetes cluster, a managed database, and a container registry — serving a workload one process could carry.',
      'The distribution bought nothing I needed. Service boundaries drawn for organizational reasons became partial-failure modes and network hops for a single operator, and every incident meant reasoning across processes instead of reading one stack trace.',
    ],
    decisions: [
      {
        title: 'Consolidate the services before optimizing any of them',
        why: 'Merging the four extracted services back into one backend removed the network hops and partial-failure modes outright, rather than tuning them.',
        rejected:
          'Tuning the distributed system in place — optimizing a topology that should not have existed.',
      },
      {
        title: 'pg-boss over RabbitMQ, which deleted the outbox entirely',
        why: 'A Postgres-backed queue enqueues a job inside the caller’s own Prisma transaction, so the outbox table and its polling relay — machinery that existed only because a broker publish cannot join a database transaction — were deleted rather than maintained.',
        rejected:
          'Keeping the broker plus the outbox — a second datastore and a bespoke relay to compensate for the first.',
      },
      {
        title: 'Rehearse the cutover, verify the dump, then delete',
        why: 'The full data path was rehearsed against a scratch database, and the final dump was checksum- and restore-list-verified before a single managed service was destroyed.',
        rejected:
          'Cutting over live while keeping the old stack as a fallback — pays for both and rehearses neither.',
      },
    ],
    results: [
      { value: '5 → 1', label: 'services in production' },
      { value: 'Zero', label: 'data loss at cutover' },
      { value: '3', label: 'managed services decommissioned' },
    ],
    tags: ['Node.js', 'TypeScript', 'PostgreSQL', 'pg-boss', 'Prisma'],
    diagram: {
      title: 'Consolidated architecture after the migration',
      width: 640,
      height: 232,
      nodes: [
        { id: 'spa', x: 20, y: 40, w: 130, h: 44, label: 'Frontend SPA' },
        { id: 'tg', x: 20, y: 148, w: 130, h: 44, label: 'Telegram', sub: 'webhook' },
        { id: 'be', x: 240, y: 90, w: 150, h: 52, label: 'backend', sub: 'Express + Prisma', accent: true },
        { id: 'jobs', x: 470, y: 40, w: 140, h: 48, label: 'pg-boss', sub: 'jobs + cron' },
        { id: 'pg', x: 470, y: 144, w: 140, h: 48, label: 'PostgreSQL' },
      ],
      edges: [
        { from: 'spa', to: 'be' },
        { from: 'tg', to: 'be' },
        { from: 'be', to: 'jobs' },
        { from: 'be', to: 'pg' },
        { from: 'jobs', to: 'pg' },
      ],
    },
  },
];
