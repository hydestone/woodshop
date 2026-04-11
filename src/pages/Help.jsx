import { useCtx } from '../App.jsx'

const SECTIONS = [
  {
    title: 'Projects',
    icon: '📁',
    items: [
      'Add a project with the + button. After saving it opens automatically for editing.',
      'Set status (Active / Planning / Paused / Complete), category, species, and finish.',
      'Build Steps: add checklist items, check them off as you go.',
      'Finishing: log each coat with product, date applied, and dry time. Get reminders when the next coat is ready.',
      'Photos: drag and drop or tap + to add progress, before/after, and finished photos.',
      'Convert a Project Idea to a project with one tap.',
      'Use the ← → arrows in the project header to step through projects.',
      'Filter by status (Active, Planning, etc.) and sort by name, category, or year.',
      'Favorites star in the project header bookmarks it for quick access.',
      'Calendar button adds a reminder to Google Calendar or Apple Reminders.',
    ],
  },
  {
    title: 'Project Ideas',
    icon: '💡',
    items: [
      'Capture things you want to build someday — no commitment required.',
      'Add a title, notes, and tags.',
      'Tap "→ Project" to instantly convert an idea into a real project in Planning status.',
    ],
  },
  {
    title: 'Wood Stock',
    icon: '🪵',
    items: [
      'Log lumber, blanks, and slabs with species, dimensions, moisture, and location.',
      'Track drying progress and log moisture readings over time.',
      'Link wood stock entries to projects so you know where each piece went.',
      'Wood Stock Gallery shows photos of your lumber.',
    ],
  },
  {
    title: 'Dashboard',
    icon: '🏠',
    items: [
      'Shows active projects, upcoming coat reminders, and workshop analytics.',
      'Charts: Projects by Year, Species Breakdown, Category Heatmap, Finish Usage, Material Flow Sankey.',
      'Wood Source Map shows where your lumber comes from — click a marker to see projects from that location.',
      'All charts respond to dark/light mode toggle.',
    ],
  },
  {
    title: 'Photos',
    icon: '📷',
    items: [
      'All Photos shows every photo across all projects.',
      'Finished Work shows photos tagged as "finished".',
      'Inspiration: drag-drop or tap + to add mood board photos. Tag any photo as "inspiration" and it appears here.',
      "Click a photo's project name to jump directly to that project.",
      'Wood Stock Gallery shows photos of raw lumber.',
    ],
  },
  {
    title: 'Shop & Maintenance',
    icon: '🔧',
    items: [
      'Shopping List: add items individually or in bulk. Tag items to a project and add a cost.',
      'Shop Maintenance: log tool maintenance with due dates and get urgent reminders.',
      'Shop Improvements: track workshop upgrade ideas and projects.',
    ],
  },
  {
    title: 'Costs',
    icon: '💰',
    items: [
      'Found in the Admin section.',
      'By Project: shows total spending per project, pulled from tagged shopping list items.',
      'General Shop: shows untagged shopping purchases.',
      'Tag shopping items to projects via the edit form to populate project costs.',
    ],
  },
  {
    title: 'Library',
    icon: '📚',
    items: [
      'Finishes: catalog your finish products with notes and feedback.',
      'Resources: save links, books, videos, and references with categories.',
    ],
  },
  {
    title: 'Creative',
    icon: '✏️',
    items: [
      'Brainstorm: quick-capture ideas, observations, and notes.',
      'Calculators: board feet, cut list optimizer, drying time estimator.',
      'Year in Review: annual summary of your builds, species, categories, and productivity.',
    ],
  },
  {
    title: 'Portfolio',
    icon: '🌐',
    items: [
      'Your public portfolio is visible at /portfolio — no login required.',
      'Only photos tagged as "portfolio" appear publicly.',
      'Share via the QR code button at the bottom of the sidebar.',
      'View Portfolio opens your public page in a new tab.',
    ],
  },
  {
    title: 'Search',
    icon: '🔍',
    items: [
      'Search bar in the top-right searches everything: projects, steps, wood stock, finishes, photos, resources, brainstorm, shopping, and maintenance.',
      'Click any result to navigate directly to that item.',
    ],
  },
  {
    title: 'Settings & Admin',
    icon: '⚙️',
    items: [
      'Categories: manage project categories, wood species, and finish names.',
      'Bulk Import: paste a CSV or tab-separated list to add many projects at once.',
      'Data Audit: spot missing fields, untagged photos, and data quality issues.',
      'Smoke Test: run through key app functions to verify everything is working.',
      'Dark mode: toggle via the moon/sun icon in the top-right corner.',
    ],
  },
  {
    title: 'Mobile',
    icon: '📱',
    items: [
      'Install as a PWA: in Safari tap Share → Add to Home Screen for a full-screen app experience.',
      'Works on iPhone and Android.',
      'Bottom tab bar: Home, Projects, Shop, Photos, More.',
      'More menu gives access to all sections.',
    ],
  },
]

export default function Help() {
  const { launchTutorial } = useCtx()
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page">
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Help</h1>
          </div>
          <p className="page-subtitle">Everything you can do in JDH Woodworks</p>
        </div>

        <div style={{ padding: '0 16px 20px' }}>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 15 }}
            onClick={launchTutorial}>
            <span style={{ fontSize: 20 }}>🎓</span> Take a Tour
          </button>
        </div>

        {SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px' }}>
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{section.title}</span>
            </div>
            <div className="group">
              {section.items.map((item, i) => (
                <div key={i} style={{
                  padding: '10px 16px',
                  fontSize: 14,
                  color: 'var(--text-2)',
                  borderBottom: i < section.items.length - 1 ? '1px solid var(--border-2)' : 'none',
                  lineHeight: 1.5,
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ padding: '8px 16px 32px', fontSize: 12, color: 'var(--text-4)', textAlign: 'center' }}>
          JDH Woodworks · Built for the shop, not the office
        </div>
      </div>
    </div>
  )
}
