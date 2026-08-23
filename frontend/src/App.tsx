import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type Email = {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  errorMessage?: string | null;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [activePage, setActivePage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [delay, setDelay] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [message, setMessage] = useState("");
  const [scheduling, setScheduling] = useState(false);

  /*
   * ============================
   * LOAD USER
   * ============================
   */

  useEffect(() => {
    loadUser();
  }, []);

  /*
   * ============================
   * LOAD EMAILS WHEN PAGE CHANGES
   * ============================
   */

  useEffect(() => {
    if (user) {
      loadEmails();
    }
  }, [user, activePage]);

  async function loadUser() {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      setLoading(false);
    }
  }

  /*
   * ============================
   * LOAD EMAILS
   * ============================
   *
   * Dashboard:
   *   Loads BOTH scheduled + sent emails
   *
   * Scheduled page:
   *   Loads only scheduled/processing
   *
   * Sent page:
   *   Loads sent/failed
   */

  async function loadEmails() {
    if (!user) return;

    try {
      /*
       * DASHBOARD
       *
       * We need both lists because
       * dashboard statistics depend
       * on all emails.
       */

      if (activePage === "dashboard") {
        const [
          scheduledResponse,
          sentResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/api/emails/scheduled?userId=${user.id}`,
            {
              credentials: "include",
            }
          ),

          fetch(
            `${API_URL}/api/emails/sent?userId=${user.id}`,
            {
              credentials: "include",
            }
          ),
        ]);

        if (
          !scheduledResponse.ok ||
          !sentResponse.ok
        ) {
          throw new Error(
            "Failed to load dashboard emails"
          );
        }

        const scheduledData =
          await scheduledResponse.json();

        const sentData =
          await sentResponse.json();

        console.log(
          "Scheduled emails:",
          scheduledData
        );

        console.log(
          "Sent emails:",
          sentData
        );

        setEmails([
          ...(Array.isArray(scheduledData)
            ? scheduledData
            : []),

          ...(Array.isArray(sentData)
            ? sentData
            : []),
        ]);

        return;
      }

      /*
       * SCHEDULED EMAILS
       */

      if (activePage === "scheduled") {
        const response = await fetch(
          `${API_URL}/api/emails/scheduled?userId=${user.id}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load scheduled emails"
          );
        }

        const data = await response.json();

        console.log(
          "Scheduled emails:",
          data
        );

        setEmails(
          Array.isArray(data)
            ? data
            : []
        );

        return;
      }

      /*
       * SENT EMAILS
       */

      if (activePage === "sent") {
        const response = await fetch(
          `${API_URL}/api/emails/sent?userId=${user.id}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load sent emails"
          );
        }

        const data = await response.json();

        console.log(
          "Sent emails:",
          data
        );

        setEmails(
          Array.isArray(data)
            ? data
            : []
        );

        return;
      }
    } catch (error) {
      console.error(
        "Failed to load emails:",
        error
      );

      setEmails([]);
    }
  }

  /*
   * ============================
   * LOGIN
   * ============================
   */

  function login() {
    window.location.href =
      `${API_URL}/auth/google`;
  }

  /*
   * ============================
   * LOGOUT
   * ============================
   */

  async function logout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(error);
    }

    setUser(null);
  }

  /*
   * ============================
   * CSV UPLOAD
   * ============================
   */

  function handleCSV(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = String(
        e.target?.result || ""
      );

      const values = text
        .split(/[\n,;]+/)
        .map((value) =>
          value.trim()
        )
        .filter(Boolean);

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const validEmails =
        values.filter(
          (email) =>
            email.toLowerCase() !==
              "email" &&
            emailRegex.test(email)
        );

      setRecipients([
        ...new Set(validEmails),
      ]);
    };

    reader.readAsText(file);
  }

  /*
   * ============================
   * SCHEDULE EMAILS
   * ============================
   */

  async function scheduleEmails(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!user) return;

    if (recipients.length === 0) {
      setMessage(
        "Please upload a CSV file."
      );
      return;
    }

    if (!subject.trim()) {
      setMessage(
        "Please enter a subject."
      );
      return;
    }

    if (!body.trim()) {
      setMessage(
        "Please enter a message."
      );
      return;
    }

    if (!startTime) {
      setMessage(
        "Please select a start time."
      );
      return;
    }

    try {
      setScheduling(true);
      setMessage("");

      const firstTime =
        new Date(startTime);

      for (
        let i = 0;
        i < recipients.length;
        i++
      ) {
        const scheduledAt =
          new Date(
            firstTime.getTime() +
              i * delay
          );

        const response =
          await fetch(
            `${API_URL}/api/emails/schedule`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                recipient:
                  recipients[i],
                subject,
                body,
                scheduledAt:
                  scheduledAt.toISOString(),
                userId: user.id,
                hourlyLimit,
                delayBetweenEmails:
                  delay,
              }),
            }
          );

        if (!response.ok) {
          const data =
            await response.json();

          throw new Error(
            data.message ||
              "Scheduling failed"
          );
        }
      }

      setMessage(
        `${recipients.length} email(s) scheduled successfully!`
      );

      setSubject("");
      setBody("");
      setRecipients([]);
      setStartTime("");

      setActivePage("scheduled");

      await loadEmails();

      setTimeout(() => {
        setShowCompose(false);
        setMessage("");
      }, 1500);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setScheduling(false);
    }
  }

  /*
   * ============================
   * STATISTICS
   * ============================
   */

  const scheduled =
    emails.filter(
      (email) =>
        email.status ===
          "SCHEDULED" ||
        email.status ===
          "PROCESSING"
    ).length;

  const sent =
    emails.filter(
      (email) =>
        email.status === "SENT"
    ).length;

  const failed =
    emails.filter(
      (email) =>
        email.status === "FAILED"
    ).length;

  const total = emails.length;

  const successRate =
    total === 0
      ? 0
      : Math.round(
          (sent / total) * 100
        );

  /*
   * ============================
   * SEARCH
   * ============================
   */

  const filteredEmails =
    useMemo(() => {
      const query =
        search.toLowerCase();

      return emails.filter(
        (email) =>
          email.recipient
            .toLowerCase()
            .includes(query) ||
          email.subject
            .toLowerCase()
            .includes(query)
      );
    }, [emails, search]);

  /*
   * ============================
   * FORMAT DATE
   * ============================
   */

  function formatDate(
    value?: string
  ) {
    if (!value) return "—";

    return new Date(
      value
    ).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /*
   * ============================
   * STATUS CLASS
   * ============================
   */

  function statusClass(
    status: string
  ) {
    if (status === "SENT")
      return "sent";

    if (status === "FAILED")
      return "failed";

    if (status === "PROCESSING")
      return "processing";

    return "scheduled";
  }

  /*
   * ============================
   * LOADING
   * ============================
   */

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loader-logo">
          R
        </div>

        <div className="loader" />
      </div>
    );
  }

  /*
   * ============================
   * LOGIN
   * ============================
   */

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-box">

          <div className="logo-large">
            R
          </div>

          <h1>
            ReachInbox
          </h1>

          <p>
            Schedule and manage your
            email campaigns with ease.
          </p>

          <button
            className="google-button"
            onClick={login}
          >
            <b>G</b>

            Continue with Google

            <span>→</span>
          </button>

          <small>
            Secure Google authentication
          </small>

        </div>
      </div>
    );
  }

  /*
   * ============================
   * MAIN DASHBOARD
   * ============================
   */

  return (
    <div className="dashboard">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-logo">
            R
          </div>

          <div>
            <strong>
              ReachInbox
            </strong>

            <span>
              Email Scheduler
            </span>
          </div>

        </div>

        <nav>

          {/* DASHBOARD */}

          <button
            className={
              activePage === "dashboard"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() =>
              setActivePage(
                "dashboard"
              )
            }
          >
            <span>⌂</span>
            Dashboard
          </button>

          <div className="nav-heading">
            CAMPAIGNS
          </div>

          {/* SCHEDULED */}

          <button
            className={
              activePage === "scheduled"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() =>
              setActivePage(
                "scheduled"
              )
            }
          >
            <span>◷</span>

            Scheduled Emails

            <em>
              {scheduled}
            </em>
          </button>

          {/* SENT */}

          <button
            className={
              activePage === "sent"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() =>
              setActivePage("sent")
            }
          >
            <span>➤</span>

            Sent Emails

            <em>
              {sent}
            </em>
          </button>

          {/* FAILED */}

          <button
            className="nav-link"
            onClick={() =>
              setActivePage("sent")
            }
          >
            <span>!</span>

            Failed Emails

            <em>
              {failed}
            </em>
          </button>

          <div className="sidebar-divider" />

          {/* CREATE */}

          <button
            className="nav-link create-link"
            onClick={() =>
              setShowCompose(true)
            }
          >
            <span>+</span>
            Create Campaign
          </button>

          <div className="nav-heading">
            ANALYTICS
          </div>

          <button className="nav-link">
            <span>▥</span>
            Overview
          </button>

          <button className="nav-link">
            <span>⌁</span>
            Performance
          </button>

          <div className="nav-heading">
            SETTINGS
          </div>

          <button className="nav-link">
            <span>♙</span>
            Account
          </button>

          <button
            className="nav-link"
            onClick={logout}
          >
            <span>↪</span>
            Logout
          </button>

        </nav>

        <div className="sidebar-bottom">

          <div className="system-status">

            <div className="status-top">

              <span className="online-dot" />

              System Status

            </div>

            <strong>
              All systems operational
            </strong>

            <small>
              Worker & queue running
            </small>

            <div className="pulse-line">
              〰〰〰
            </div>

          </div>

          <div className="profile">

            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
              />
            ) : (
              <div className="profile-avatar">
                {user.name
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div>

              <strong>
                {user.name}
              </strong>

              <span>
                {user.email}
              </span>

            </div>

            <button>
              ⋮
            </button>

          </div>

        </div>

      </aside>

      {/* MAIN */}

      <main className="main">

        {/* TOPBAR */}

        <header className="topbar">

          <div className="mobile-logo">
            R
          </div>

          <div className="topbar-right">

            <div className="today">

              <span>▣</span>

              {new Date().toLocaleDateString(
                [],
                {
                  weekday:
                    "long",
                  month:
                    "short",
                  day:
                    "numeric",
                  year:
                    "numeric",
                }
              )}

            </div>

            <button
              className="create-button"
              onClick={() =>
                setShowCompose(true)
              }
            >
              <span>+</span>
              Create Campaign
            </button>

          </div>

        </header>

        <div className="content">

          {/* WELCOME */}

          <section className="welcome">

            <div>

              <h1>
                Good morning,{" "}
                {user.name.split(
                  " "
                )[0]}
                ! 👋
              </h1>

              <p>
                Here's what's happening
                with your email campaigns.
              </p>

            </div>

          </section>

          {/* STATS */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon purple">
                ✉
              </div>

              <div className="stat-info">

                <span>
                  Total Emails
                </span>

                <strong>
                  {total}
                </strong>

                <small>
                  All campaign emails
                </small>

              </div>

              <div className="trend purple-trend">
                <span>↗</span>
                <small>12.5%</small>
              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon blue">
                ◷
              </div>

              <div className="stat-info">

                <span>
                  Scheduled
                </span>

                <strong>
                  {scheduled}
                </strong>

                <small>
                  Waiting to be sent
                </small>

              </div>

              <div className="trend blue-trend">
                <span>↗</span>
                <small>8.2%</small>
              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon green">
                ✓
              </div>

              <div className="stat-info">

                <span>
                  Sent
                </span>

                <strong>
                  {sent}
                </strong>

                <small>
                  Successfully delivered
                </small>

              </div>

              <div className="trend green-trend">
                <span>↗</span>
                <small>18.4%</small>
              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon red">
                ×
              </div>

              <div className="stat-info">

                <span>
                  Success Rate
                </span>

                <strong>
                  {successRate}%
                </strong>

                <small>
                  Delivery success rate
                </small>

              </div>

              <div className="trend red-trend">
                <span>↘</span>
                <small>2.1%</small>
              </div>

            </div>

          </section>

          {/* ANALYTICS */}

          <section className="analytics-grid">

            <div className="performance-card">

              <h2>
                Campaign Performance
              </h2>

              <div className="performance-content">

                <div
                  className="donut"
                  style={{
                    background:
                      `conic-gradient(
                        #635bff ${successRate}%,
                        #eef0ff ${successRate}% 100%
                      )`,
                  }}
                >

                  <div>

                    <strong>
                      {successRate}%
                    </strong>

                    <span>
                      Success Rate
                    </span>

                  </div>

                </div>

                <div className="legend">

                  <div>

                    <span className="green-dot" />
                    <strong>
                      Sent
                    </strong>
                    <small>
                      {sent}
                    </small>

                  </div>

                  <div>

                    <span className="blue-dot" />
                    <strong>
                      Scheduled
                    </strong>
                    <small>
                      {scheduled}
                    </small>

                  </div>

                  <div>

                    <span className="red-dot" />
                    <strong>
                      Failed
                    </strong>
                    <small>
                      {failed}
                    </small>

                  </div>

                </div>

              </div>

            </div>

            <div className="campaign-cta">

              <div>

                <h2>
                  Ready to reach your
                  leads?
                </h2>

                <p>
                  Create a new campaign
                  and schedule emails in
                  minutes. Upload your
                  leads, write your message,
                  and let ReachInbox do
                  the rest.
                </p>

                <button
                  onClick={() =>
                    setShowCompose(true)
                  }
                >
                  Create New Campaign →
                </button>

              </div>

              <div className="paper-plane">
                ➤
              </div>

            </div>

          </section>

          {/* EMAIL ACTIVITY */}

          <section className="email-card">

            <div className="email-card-header">

              <div>

                <h2>
                  {activePage === "sent"
                    ? "Sent Emails"
                    : activePage ===
                        "scheduled"
                    ? "Scheduled Emails"
                    : "Email Activity"}
                </h2>

                <p>
                  {activePage === "sent"
                    ? "View emails that have been sent or failed."
                    : activePage ===
                        "scheduled"
                    ? "View and manage your scheduled email campaigns."
                    : "Track all your email campaign activity."}
                </p>

              </div>

              <button
                className="refresh"
                onClick={loadEmails}
              >
                ↻ Refresh
              </button>

            </div>

            <div className="table-toolbar">

              <div className="search-box">

                <span>⌕</span>

                <input
                  placeholder="Search recipient or subject..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* EMPTY STATE */}

            {filteredEmails.length ===
            0 ? (

              <div className="empty-state">

                <div>
                  {activePage ===
                  "sent"
                    ? "✓"
                    : "✉"}
                </div>

                <h3>
                  {activePage ===
                  "sent"
                    ? "No sent emails"
                    : activePage ===
                      "scheduled"
                    ? "No scheduled emails"
                    : "No email activity"}
                </h3>

                <p>
                  {activePage ===
                  "sent"
                    ? "Emails that are successfully sent will appear here."
                    : activePage ===
                      "scheduled"
                    ? "Create a campaign to get started."
                    : "Your email activity will appear here."}
                </p>

                {activePage !==
                  "sent" && (
                  <button
                    onClick={() =>
                      setShowCompose(
                        true
                      )
                    }
                  >
                    Create Campaign
                  </button>
                )}

              </div>

            ) : (

              <div className="table-wrapper">

                <table>

                  <thead>

                    <tr>

                      <th>
                        RECIPIENT
                      </th>

                      <th>
                        SUBJECT
                      </th>

                      <th>
                        {activePage ===
                        "sent"
                          ? "SENT"
                          : activePage ===
                            "scheduled"
                          ? "SCHEDULED"
                          : "DATE"}
                      </th>

                      <th>
                        STATUS
                      </th>

                      <th />

                    </tr>

                  </thead>

                  <tbody>

                    {filteredEmails.map(
                      (email) => (

                        <tr
                          key={
                            email.id
                          }
                        >

                          <td>

                            <div className="recipient">

                              <div className="recipient-avatar">

                                {email.recipient
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}

                              </div>

                              <span>
                                {
                                  email.recipient
                                }
                              </span>

                            </div>

                          </td>

                          <td>

                            <span className="subject">
                              {
                                email.subject
                              }
                            </span>

                          </td>

                          <td>

                            <div className="date-cell">

                              <span>
                                ▣
                              </span>

                              {formatDate(
                                activePage ===
                                "sent"
                                  ? email.sentAt
                                  : activePage ===
                                    "scheduled"
                                  ? email.scheduledAt
                                  : email.status ===
                                    "SENT"
                                  ? email.sentAt
                                  : email.scheduledAt
                              )}

                            </div>

                          </td>

                          <td>

                            <span
                              className={`status-badge ${statusClass(
                                email.status
                              )}`}
                            >

                              <i />

                              {email.status}

                            </span>

                          </td>

                          <td>

                            <button className="more">
                              ⋯
                            </button>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

            {filteredEmails.length >
              0 && (

              <div className="table-footer">

                <span>

                  Showing 1 to{" "}
                  {
                    filteredEmails.length
                  }{" "}
                  of{" "}
                  {
                    filteredEmails.length
                  }{" "}
                  email
                  {filteredEmails.length !==
                  1
                    ? "s"
                    : ""}

                </span>

                <div>

                  <button>
                    ‹
                  </button>

                  <button className="page">
                    1
                  </button>

                  <button>
                    ›
                  </button>

                </div>

              </div>

            )}

          </section>

          <footer>

            © 2026 ReachInbox

            <span>•</span>

            All rights reserved

          </footer>

        </div>

      </main>

      {/* CREATE CAMPAIGN MODAL */}

      {showCompose && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCompose(false);
            }
          }}
        >

          <div className="compose-modal">

            <div className="compose-header">

              <div>

                <span>
                  NEW CAMPAIGN
                </span>

                <h2>
                  Create Campaign
                </h2>

                <p>
                  Set up your email campaign
                  and schedule your leads.
                </p>

              </div>

              <button
                onClick={() =>
                  setShowCompose(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <form
              className="compose-form"
              onSubmit={
                scheduleEmails
              }
            >

              <label>
                Upload Leads CSV
              </label>

              <div className="upload-area">

                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={
                    handleCSV
                  }
                />

                <div className="upload-icon">
                  ↑
                </div>

                <strong>
                  Drop your CSV here
                </strong>

                <span>
                  or click to browse
                </span>

                {recipients.length >
                  0 && (

                  <div className="upload-success">

                    ✓{" "}
                    {
                      recipients.length
                    }{" "}
                    email
                    {recipients.length !==
                    1
                      ? "s"
                      : ""}{" "}
                    detected

                  </div>

                )}

              </div>

              <label>
                Subject
              </label>

              <input
                className="form-input"
                value={subject}
                onChange={(e) =>
                  setSubject(
                    e.target.value
                  )
                }
                placeholder="Enter email subject"
              />

              <label>
                Message
              </label>

              <textarea
                className="form-input"
                rows={6}
                value={body}
                onChange={(e) =>
                  setBody(
                    e.target.value
                  )
                }
                placeholder="Write your email..."
              />

              <div className="form-grid">

                <div>

                  <label>
                    Start Time
                  </label>

                  <input
                    className="form-input"
                    type="datetime-local"
                    value={
                      startTime
                    }
                    onChange={(e) =>
                      setStartTime(
                        e.target.value
                      )
                    }
                  />

                </div>

                <div>

                  <label>
                    Delay
                  </label>

                  <select
                    className="form-input"
                    value={delay}
                    onChange={(e) =>
                      setDelay(
                        Number(
                          e.target.value
                        )
                      )
                    }
                  >

                    <option value={2000}>
                      2 seconds
                    </option>

                    <option value={5000}>
                      5 seconds
                    </option>

                    <option value={10000}>
                      10 seconds
                    </option>

                    <option value={30000}>
                      30 seconds
                    </option>

                  </select>

                </div>

                <div>

                  <label>
                    Hourly Limit
                  </label>

                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={
                      hourlyLimit
                    }
                    onChange={(e) =>
                      setHourlyLimit(
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                </div>

              </div>

              {message && (

                <div
                  className={
                    message.includes(
                      "successfully"
                    )
                      ? "form-message success"
                      : "form-message error"
                  }
                >
                  {message}
                </div>

              )}

              <div className="compose-footer">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowCompose(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className="schedule-button"
                  disabled={
                    scheduling
                  }
                >
                  {scheduling
                    ? "Scheduling..."
                    : "Schedule Campaign →"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;