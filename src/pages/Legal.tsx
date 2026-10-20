import { Link } from "react-router-dom";
import { Heading, Page } from "../components/ui";

const effective = "20 October 2026";

function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <Page className="legal-page">
      <Heading title={title} description={intro} />
      <article className="panel legal-card">
        <p className="legal-effective">Effective {effective}</p>
        {children}
        <p className="legal-footnote">
          Questions about this page? Contact the site owner through the support
          channel for this Study World deployment. See also our{" "}
          <Link to="/privacy">Privacy Policy</Link> and{" "}
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </article>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="What Study World stores, where it lives, and the control you keep."
    >
      <h2>What we store</h2>
      <p>
        Study World stores the study records you create: subjects, topics,
        tasks, revision schedules, recall ratings, recorded test results, your
        sleep log, study streak, and preferences. If you create an account, your
        email address and authentication credentials are stored by our
        authentication provider (Supabase).
      </p>

      <h2>Where it lives</h2>
      <p>
        Without an account, your records stay in this browser's local storage.
        With an account, your records sync to your private Supabase workspace so
        you can continue on another device. Local copies and recovery snapshots
        may also remain on each device you use.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>We do not sell your data or share it with advertisers.</li>
        <li>We do not use your study records to train AI models.</li>
        <li>We do not read your workspace for marketing purposes.</li>
      </ul>

      <h2>AI-assisted paste (optional)</h2>
      <p>
        If you choose the AI-assisted import, the text you paste is sent to our
        server and to the configured model provider (OpenRouter) solely to
        produce an editable draft. The draft is never saved until you review and
        confirm it. The local reader does not use AI at all.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We use local storage for your workspace, preferences, and session
        tokens. We do not use advertising cookies or third-party trackers.
      </p>

      <h2>Your control</h2>
      <p>
        You can export a full backup at any time from Settings → Your data, and
        you can clear browser data to remove the local copy. Account holders can
        request deletion of their account and synced workspace.
      </p>

      <h2>Children</h2>
      <p>
        Study World is a study tool intended for students and adult learners. It
        is not directed at children under 13, and accounts should not be created
        for them without a guardian's consent.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially, the effective date above will be
        updated and the change will be noted in the app.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      intro="The simple rules for using Study World."
    >
      <h2>Using Study World</h2>
      <p>
        Study World is a personal study planner. You may use it to plan study
        work, schedule revisions, record results, and track sleep and streaks.
        You are responsible for the accuracy of what you record.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your sign-in details secure and use an account you are entitled to
        use. You are responsible for activity under your account. Tell us
        promptly if you believe your account has been compromised.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to break, overload, or probe the service.</li>
        <li>Do not use AI import to process content you have no right to use.</li>
        <li>Do not resell or redistribute access to the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of everything you enter. We store and process it only
        to run the features you use, as described in the Privacy Policy.
      </p>

      <h2>AI-assisted drafts</h2>
      <p>
        AI-assisted import produces a draft that may contain errors. Nothing is
        saved until you review and confirm it, and you remain responsible for
        the tasks you accept. The local reader is rule-based and can also make
        mistakes; always check the review screen.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided as-is. Features may change, and downtime may
        occur for maintenance or hosting reasons. Keep periodic backups from
        Settings → Your data.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, Study World is not liable for indirect
        or consequential losses arising from use of the service, including lost
        study data where no backup was kept.
      </p>

      <h2>Changes</h2>
      <p>
        Continued use after an update to these terms constitutes acceptance of
        the updated terms.
      </p>
    </LegalShell>
  );
}
