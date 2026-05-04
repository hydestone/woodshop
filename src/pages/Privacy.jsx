export default function Privacy() {
  const EFFECTIVE = 'May 3, 2026'
  const CONTACT   = 'johnhyde23@gmail.com'
  const APP_NAME  = 'JDH Woodworks'

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--c-text-muted)', lineHeight: 1.8 }}>{children}</div>
    </div>
  )

  return (
    <div className="scroll-page" style={{ paddingBottom: 60 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px' }}>
        <div className="page-header">
          <h1 className="page-title">Privacy Policy</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-faint)', marginTop: 4 }}>Effective {EFFECTIVE}</p>
        </div>

        <div style={{ marginTop: 8 }}>
          <Section title="Overview">
            <p>{APP_NAME} is a personal woodworking workshop management app. This policy explains what data we collect, how it is used, and your rights regarding your data. We take your privacy seriously and collect only what is necessary to make the app work.</p>
          </Section>

          <Section title="Who We Are">
            <p>JDH Woodworks is an independent app operated by John Hyde. If you have any questions about this policy or your data, contact us at <a href={`mailto:${CONTACT}`} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{CONTACT}</a>.</p>
          </Section>

          <Section title="What We Collect">
            <p style={{ marginBottom: 10 }}>We collect only the data you actively provide:</p>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>Account information</strong> — your email address, used for login and account recovery. No password is stored by us; authentication is handled by Supabase.</li>
              <li><strong>Project data</strong> — project names, species, categories, statuses, steps, finishing coats, costs, and notes you create inside the app.</li>
              <li><strong>Photos</strong> — images you upload are stored in a private, access-controlled cloud bucket. Photos are not public unless you explicitly share a portfolio link.</li>
              <li><strong>Wood stock and shop data</strong> — species, dimensions, moisture readings, shop improvements, tool inventory, and shopping lists you enter.</li>
              <li><strong>Calculator notes</strong> — text you save in the Notes tab is stored locally in your browser and in your account.</li>
            </ul>
          </Section>

          <Section title="What We Do Not Collect">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>We do not collect location data.</li>
              <li>We do not use tracking pixels, third-party analytics, or advertising networks.</li>
              <li>We do not sell, rent, or share your personal data with any third parties for marketing purposes.</li>
              <li>We do not collect payment information (there is currently no paid tier).</li>
            </ul>
          </Section>

          <Section title="How We Use Your Data">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>To provide the app</strong> — your data is used to display your projects, photos, and workshop information back to you.</li>
              <li><strong>To sync across devices</strong> — data is stored in Supabase so you can use the app on your phone and laptop with the same account.</li>
              <li><strong>To improve the app</strong> — we may review aggregate, anonymized usage patterns (e.g., which features are used most) to guide development decisions. No individual records are shared.</li>
            </ul>
          </Section>

          <Section title="Data Storage and Security">
            <p>Your data is stored in Supabase, a managed cloud database service. All database access is protected by Row Level Security (RLS) — no user can access another user's data. Photos are stored in a private Supabase Storage bucket. Data is transmitted over HTTPS. We retain your data as long as your account exists. You may request deletion of your account and all associated data by contacting us.</p>
          </Section>

          <Section title="Photos">
            <p>Photos you upload are stored privately and are not accessible to other users. If you enable the portfolio feature (not yet available), selected photos may be visible via a public URL you control. You can delete any photo at any time. Deleted photos are moved to a 30-day trash before permanent removal.</p>
          </Section>

          <Section title="Third-Party Services">
            <p style={{ marginBottom: 8 }}>We use the following services to operate the app:</p>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>Supabase</strong> (supabase.com) — database, authentication, and file storage. Subject to Supabase's privacy policy.</li>
              <li><strong>Vercel</strong> (vercel.com) — web hosting and deployment. Subject to Vercel's privacy policy.</li>
            </ul>
            <p style={{ marginTop: 8 }}>We do not use Google Analytics, Facebook Pixel, Mixpanel, or any other third-party tracking service.</p>
          </Section>

          <Section title="Your Rights">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>Access</strong> — you can view all your data within the app at any time.</li>
              <li><strong>Export</strong> — you can export your project data (feature coming soon).</li>
              <li><strong>Deletion</strong> — you can delete individual projects, photos, and records within the app. To delete your entire account and all data, contact us at {CONTACT}.</li>
              <li><strong>Correction</strong> — you can edit any data you've entered at any time.</li>
            </ul>
          </Section>

          <Section title="Children">
            <p>This app is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us with personal information, contact us and we will delete it.</p>
          </Section>

          <Section title="Changes to This Policy">
            <p>We may update this policy as the app evolves. Significant changes will be communicated via the app or by email. Continued use of the app after a policy update constitutes acceptance of the revised terms.</p>
          </Section>

          <Section title="Contact">
            <p>Questions or requests regarding your data: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{CONTACT}</a></p>
          </Section>
        </div>
      </div>
    </div>
  )
}
