import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  ClipboardCheck,
  Info,
  RotateCcw,
} from "../components/icons";
import { useApp } from "../data/AppProvider";
import { latestTopicScore, subjectFor, topicStatus } from "../domain/engine";
import { insights } from "../domain/insights";
import type { InsightPeriod } from "../domain/insights";
import { displayDate } from "../domain/model";
import {
  Chip,
  Empty,
  Heading,
  Page,
  SectionTitle,
  SubjectIcon,
} from "../components/ui";
const ratingColors = ["#ce4855", "#cc861c", "#2e8a62", "#4475d4"];
export function AnalyticsPage() {
  const { data, date } = useApp(),
    [period, setPeriod] = useState<InsightPeriod>("30"),
    [tab, setTab] = useState<"activity" | "scores">("activity");
  const report = insights(data, date, period),
    activeTopics = data.topics.filter((t) => !subjectFor(data, t.id)?.archived),
    weak = activeTopics.filter((t) => topicStatus(data, t.id) === "weak");
  const max = Math.max(
    data.preferences.dailyMinutes,
    1,
    ...report.week.flatMap((day) => [day.scheduled, day.done]),
  );
  let end = 0;
  const stops = report.ratings.map((r, i) => {
    const start = end;
    end += report.recalls.length ? (r.count / report.recalls.length) * 100 : 0;
    return `${ratingColors[i]} ${start}% ${end}%`;
  });
  return (
    <Page className="analytics-page">
      <Heading
        title="Analytics"
        description="Built only from what you recorded. Activity, recall and test scores stay separate."
        action={
          <div className="tabs period-tabs">
            {(["7", "30", "all"] as const).map((value) => (
              <button
                key={value}
                className={period === value ? "active" : ""}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {value === "all" ? "All time" : `${value} days`}
              </button>
            ))}
          </div>
        }
      />
      <nav className="section-tabs" aria-label="Analytics sections">
        {(
          [
            ["activity", "Activity"],
            ["scores", "Scores"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="insight-grid" hidden={tab !== "activity"}>
      <div className="insight-stats">
        {[
          [
            "Study days",
            report.studyDays,
            period === "all"
              ? "Across recorded history"
              : `Within the last ${period} days`,
          ],
          [
            "Tasks completed",
            report.completed.length,
            "Actual completions, not clicks",
          ],
          [
            "Recalls recorded",
            report.recalls.length,
            "External topic tests excluded",
          ],
          [
            "Topic test average",
            report.average === null ? "—" : `${Math.round(report.average)}%`,
            `${report.scores.length} topic scores in ${report.tests.length} tests`,
          ],
        ].map(([label, value, note]) => (
          <section className="panel insight-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </section>
        ))}
      </div>
        <section className="panel heatmap-card">
          <SectionTitle
            title="Study consistency"
            action={<span className="small muted">Last 12 weeks</span>}
          />
          <div
            className="heatmap-grid"
            role="group"
            aria-label="Recorded learning activity over the last twelve weeks"
          >
            {report.activity.map((day) => (
              <span
                key={day.day}
                tabIndex={0}
                role="img"
                className={!day.inPeriod ? "out-of-period" : ""}
                data-level={Math.min(4, day.count)}
                title={`${displayDate(day.day)}: ${day.inPeriod ? `${day.count} recorded learning events` : "outside selected period"}`}
                aria-label={`${displayDate(day.day)}: ${day.inPeriod ? `${day.count} recorded events` : "outside selected period"}`}
              />
            ))}
          </div>
          <div className="heatmap-key">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} data-level={level} />
            ))}
            <span>More</span>
          </div>
          <p className="chart-footnote">
            Completions, recalls and test records. Faded days are outside your
            selected period.
          </p>
        </section>
        <section className="panel scheduled-chart-card">
          <SectionTitle title="Scheduled vs completed" />
          <div className="chart-legend">
            <span>
              <i style={{ background: "#c7d2f4" }} />
              Scheduled estimates
            </span>
            <span>
              <i style={{ background: "#414bb5" }} />
              Completed estimates
            </span>
          </div>
          <div className="estimate-chart">
            <div
              className="budget-line"
              style={{
                bottom: `${(data.preferences.dailyMinutes / max) * 100}%`,
              }}
            />
            <div className="estimate-columns">
              {report.week.map((day) => (
                <div
                  className={`estimate-day ${!day.inPeriod ? "out-of-period" : ""}`}
                  key={day.day}
                  title={`${displayDate(day.day)}: ${day.scheduled} scheduled min, ${day.done} completed estimate min`}
                >
                  <div className="estimate-pair">
                    <i style={{ height: `${(day.scheduled / max) * 100}%` }} />
                    <i style={{ height: `${(day.done / max) * 100}%` }} />
                  </div>
                  <span>
                    {day.day === date
                      ? "Today"
                      : displayDate(day.day, { weekday: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="chart-footnote">
            Task estimates, not tracked time. Past scheduled dates reflect
            current records, not historical plan snapshots. Dashed line: your
            current daily budget.
          </p>
        </section>
      </div>
      <div className="insight-grid" hidden={tab !== "scores"}>
        <section className="panel recall-donut-card">
          <SectionTitle title="How well you remembered" />
          <div className="recall-breakdown">
            <div
              className="recall-donut"
              style={{
                background: report.recalls.length
                  ? `conic-gradient(${stops.join(",")})`
                  : "#eeece7",
              }}
            >
              <div>
                <strong>{report.recalls.length}</strong>
                <span>recalls</span>
              </div>
            </div>
            <div className="recall-legend">
              {report.ratings.map((r, i) => (
                <div key={r.rating}>
                  <i style={{ background: ratingColors[i] }} />
                  <span>{r.rating}</span>
                  <strong>
                    {report.recalls.length
                      ? Math.round((r.count / report.recalls.length) * 100)
                      : 0}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <p className="chart-footnote">
            Only your actual recall ratings. Test-derived ratings are not mixed
            into this chart.
          </p>
        </section>
        <section className="panel subject-scores-card">
          <SectionTitle
            title="Test scores by subject"
            action={<Chip>Topic scores</Chip>}
          />
          {data.subjects
            .filter((s) => !s.archived)
            .map((subject) => {
              const scores = report.scores.filter(
                  (score) =>
                    data.topics.find((t) => t.id === score.topicId)
                      ?.subjectId === subject.id,
                ),
                average = scores.length
                  ? scores.reduce((n, s) => n + s.percent, 0) / scores.length
                  : null;
              return (
                <Link
                  className="subject-score-line"
                  key={subject.id}
                  to={`/subjects/${subject.id}`}
                >
                  <SubjectIcon subject={subject} size={15} />
                  <span>{subject.name}</span>
                  {average === null ? (
                    <small>No topic scores yet</small>
                  ) : (
                    <>
                      <div>
                        <i
                          style={{
                            width: `${average}%`,
                            background: subject.color,
                          }}
                        />
                      </div>
                      <b>{Math.round(average)}%</b>
                    </>
                  )}
                </Link>
              );
            })}
        </section>
        <section className="panel weak-topics-card">
          <SectionTitle
            title="Topics that need attention"
            action={<Chip tone="rose">{weak.length} flagged</Chip>}
          />
          <p className="chart-footnote">
            Current topic signals use all retained history, independent of the
            chart period.
          </p>
          {weak.length ? (
            weak.map((topic) => (
              <Link
                className="weak-row"
                key={topic.id}
                to={`/subjects/${topic.subjectId}?topic=${encodeURIComponent(topic.id)}`}
              >
                <SubjectIcon subject={subjectFor(data, topic.id)!} size={16} />
                <div>
                  <strong>{topic.name}</strong>
                  <span>
                    {latestTopicScore(data, topic.id)
                      ? `Latest topic score ${Math.round(latestTopicScore(data, topic.id)!.percent)}%`
                      : "Forgot on the latest recall"}
                  </span>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))
          ) : (
            <Empty title="Nothing flagged yet">
              Low scores or a forgotten recall will appear here. No evidence is
              not mastery.
            </Empty>
          )}
        </section>
        <section className="panel evidence-definitions">
          <SectionTitle title="Four different things" />
          <div>
            {[
              [
                BookOpenCheck,
                "Activity",
                "Completed work and estimated effort. Not proof of learning.",
              ],
              [Brain, "Recall", "Your Forgot, Hard, Good and Easy ratings."],
              [
                ClipboardCheck,
                "Test scores",
                "Results from tests you took elsewhere.",
              ],
              [
                RotateCcw,
                "Topic strength",
                "Current evidence from recalls and topic scores.",
              ],
            ].map(([Icon, title, text]) => {
              const Symbol = Icon as typeof Info;
              return (
                <article key={String(title)}>
                  <h3>
                    <Symbol size={16} />
                    {String(title)}
                  </h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </Page>
  );
}
