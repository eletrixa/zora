// Polls the order status after checkout: 2, 4, 8, 15, 30 s (guide, Reading the order).
// Project: zorasocial. Module: public/static/return.js. Tested: n/a (browser script)
(() => {
  const node = document.getElementById("order");
  if (!node) return;
  const uuid = node.dataset.uuid;
  const waits = [2, 4, 8, 15, 30];
  let attempt = 0;
  const poll = async () => {
    try {
      const response = await fetch(`/3pd/return/status?grouponOrderUuid=${encodeURIComponent(uuid)}`, { headers: { accept: "application/json" } });
      const order = await response.json();
      if (order.kind === "order" && !order.pending) return location.reload();
    } catch (_) {
      /* keep polling */
    }
    if (attempt < waits.length) setTimeout(poll, waits[attempt++] * 1000);
    else node.textContent = "Still confirming. Your Groupon confirmation email has your voucher.";
  };
  setTimeout(poll, waits[attempt++] * 1000);
})();
