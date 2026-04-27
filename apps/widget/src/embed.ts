import React from "react";
import { createRoot } from "react-dom/client";
import { Widget } from "./Widget.js";

/**
 * The embed script — this runs when the <script> tag loads.
 *
 * It reads configuration from data-* attributes on the script tag:
 *   <script
 *     src="https://cdn.example.com/chatbot.js"
 *     data-website-id="appviewx"
 *     data-primary-color="#185fa5"
 *     data-bot-name="AVX Assistant"
 *     data-api-url="https://api.example.com"
 *   ></script>
 *
 * Why data attributes instead of a config object?
 * Marketing/ops teams who embed the widget don't write JavaScript.
 * They copy-paste a script tag. data-* attributes are the
 * simplest interface — no JSON, no function calls.
 *
 * Why find the current script tag?
 * document.currentScript points to the <script> element that's
 * currently executing. This is the standard way to read
 * configuration from the script tag itself.
 */

/**
 * Why Shadow DOM?
 *
 * Without Shadow DOM:
 * - Host site's CSS (Bootstrap, Tailwind, custom) leaks into widget
 * - Widget CSS leaks into host site
 * - Host site's JavaScript event handlers can interfere
 *
 * With Shadow DOM:
 * - Complete CSS isolation — styles never cross the boundary
 * - Our Tailwind classes don't conflict with host site's Tailwind
 * - The widget renders identically on every website
 *
 * This is why major embedded widgets (Intercom, Drift, HubSpot)
 * all use Shadow DOM or iframes.
 */
function mountWidget() {
  // Find the script tag that loaded this bundle
  const scriptTag =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector("script[data-website-id]");

  if (!scriptTag) {
    console.error(
      "[ChatbotWidget] Could not find script tag with data-website-id",
    );
    return;
  }

  // Read configuration from data attributes
  const websiteId = scriptTag.getAttribute("data-website-id");
  const primaryColor =
    scriptTag.getAttribute("data-primary-color") ?? "#185fa5";
  const botName = scriptTag.getAttribute("data-bot-name") ?? "AI Assistant";
  const apiUrl =
    scriptTag.getAttribute("data-api-url") ?? "http://localhost:4000";

  if (!websiteId) {
    console.error("[ChatbotWidget] data-website-id is required");
    return;
  }

  // Create mount point — a div appended to document.body
  const container = document.createElement("div");
  container.id = "chatbot-widget-root";
  document.body.appendChild(container);

  /**
   * Attach a Shadow DOM to the container.
   * mode: 'open' means JavaScript outside the shadow root
   * can still query inside it — useful for debugging.
   * mode: 'closed' would prevent any outside access.
   * 'open' is the standard choice for widgets.
   */
  const shadowRoot = container.attachShadow({ mode: "open" });

  /**
   * Inject our compiled CSS into the Shadow DOM.
   * Without this, Tailwind classes inside the shadow root
   * would have no styles applied — the host site's stylesheets
   * don't cross the shadow boundary.
   *
   * __WIDGET_CSS__ is replaced at build time by Vite
   * with the compiled CSS string.
   */
  const style = document.createElement("style");
  style.textContent = "/* widget styles injected by build */";
  shadowRoot.appendChild(style);

  // Create React mount point inside Shadow DOM
  const reactRoot = document.createElement("div");
  shadowRoot.appendChild(reactRoot);

  // Mount the React widget
  const root = createRoot(reactRoot);
  root.render(
    React.createElement(Widget, {
      websiteId,
      apiUrl,
      primaryColor,
      botName,
    }),
  );
}

/**
 * Mount when DOM is ready.
 * The script tag might load before the body element exists.
 * DOMContentLoaded ensures body is available.
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountWidget);
} else {
  mountWidget();
}
