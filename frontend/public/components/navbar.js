// public/components/navbar.js
document.addEventListener("DOMContentLoaded", () => {
  const placeholder = document.getElementById("navbar-placeholder");
  if (!placeholder) return;

  fetch("/components/navbar.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("navbar-placeholder").innerHTML = html;

    // Role check for admin
    fetch("/api/session-info", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.role === 3) {
          document.getElementById("adminLink")?.classList.remove("hidden");
        }
      });

    // Logout handler
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      const res = await fetch("/admin/logout", { method: "GET" });
      if (res.redirected) window.location.href = res.url;
    });
  });

});
