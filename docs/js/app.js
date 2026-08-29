(function () {
  "use strict";

  var FRAMES = [
    { key: "img", label: "Image" },
    { key: "gt", label: "Observed" },
    { key: "pred", label: "OCPNet" },
    { key: "err", label: "Error map" }
  ];

  /* ---- reveal on scroll ---- */
  function reveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) { if (r.isIntersecting) { r.target.classList.add("in"); io.unobserve(r.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---- nav highlighting ---- */
  function nav() {
    var links = [].slice.call(document.querySelectorAll(".navlink"));
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    function mark() {
      var y = window.scrollY + 120, best = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) best = i; });
      links.forEach(function (a, i) { a.classList.toggle("active", i === best); });
    }
    window.addEventListener("scroll", mark, { passive: true });
    mark();
  }

  /* ---- sortable tables with inline magnitude bars ---- */
  function tables() {
    [].forEach.call(document.querySelectorAll("table[data-sortable]"), function (tb) {
      var body = tb.tBodies[0];
      var heads = [].slice.call(tb.tHead.rows[0].cells);
      var lower = (tb.getAttribute("data-lower") || "").split(",").map(Number);

      function bars() {
        heads.forEach(function (h, c) {
          if (c === 0) return;
          var cells = [].slice.call(body.rows).map(function (r) { return r.cells[c]; });
          var vals = cells.map(function (d) { return parseFloat(d.getAttribute("data-v")); });
          var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
          cells.forEach(function (d, i) {
            var bar = d.querySelector(".cellbar");
            var f = hi === lo ? 1 : (vals[i] - lo) / (hi - lo);
            if (lower.indexOf(c) >= 0) f = 1 - f;
            bar.style.width = (8 + 92 * f).toFixed(1) + "%";
          });
        });
      }

      heads.forEach(function (h, c) {
        h.classList.add("sortable");
        h.addEventListener("click", function () {
          var desc = !h.classList.contains("desc");
          heads.forEach(function (o) { o.classList.remove("asc", "desc"); });
          h.classList.add(desc ? "desc" : "asc");
          var rows = [].slice.call(body.rows);
          rows.sort(function (a, b) {
            var x = a.cells[c], y = b.cells[c];
            if (c === 0) return (desc ? -1 : 1) * x.textContent.localeCompare(y.textContent);
            return (desc ? -1 : 1) * (parseFloat(y.getAttribute("data-v")) - parseFloat(x.getAttribute("data-v")));
          });
          rows.forEach(function (r) { body.appendChild(r); });
        });
      });

      [].forEach.call(body.querySelectorAll("td"), function (d, i) {
        if (d.cellIndex === 0) return;
        d.setAttribute("data-v", parseFloat(d.textContent));
        var b = document.createElement("span");
        b.className = "cellbar";
        b.style.width = "0%";
        d.appendChild(b);
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (rows, o) {
          rows.forEach(function (r) { if (r.isIntersecting) { bars(); o.disconnect(); } });
        }, { threshold: 0.15 }).observe(tb);
      } else { bars(); }
    });
  }

  /* ---- qualitative viewer: dataset tabs, frame cycling, drag comparison ---- */
  function viewer(data) {
    var root = document.getElementById("viewer");
    if (!root || !data.length) return;
    var set = 0, item = 0, frame = 3, playing = false, timer = null, split = 50;

    var dtabs = root.querySelector("#dtabs"),
        ftabs = root.querySelector("#ftabs"),
        thumbs = root.querySelector("#thumbs"),
        stage = root.querySelector("#stage"),
        base = root.querySelector("#base"),
        top = root.querySelector("#top"),
        lab = root.querySelector("#lab"),
        meta = root.querySelector("#meta"),
        play = root.querySelector("#play"),
        playTxt = root.querySelector("#playtxt");

    data.forEach(function (d, i) {
      var b = document.createElement("button");
      b.className = "tab" + (i === 0 ? " active" : "");
      b.textContent = d.label;
      b.onclick = function () { set = i; item = 0; sync(); };
      dtabs.appendChild(b);
    });
    FRAMES.forEach(function (f, i) {
      var b = document.createElement("button");
      b.className = "tab";
      b.textContent = f.label;
      b.onclick = function () { stop(); frame = i; sync(); };
      ftabs.appendChild(b);
    });

    function cur() { return data[set].items[item]; }

    function stop() { playing = false; clearInterval(timer); playTxt.textContent = "Cycle frames"; play.classList.remove("active"); }
    play.onclick = function () {
      if (playing) { stop(); sync(); return; }
      playing = true; playTxt.textContent = "Stop"; play.classList.add("active");
      timer = setInterval(function () { frame = (frame + 1) % FRAMES.length; sync(); }, 900);
      sync();
    };

    function sync() {
      var it = cur();
      base.src = it.img;
      top.src = it[FRAMES[frame].key];
      lab.textContent = FRAMES[frame].label;
      stage.classList.toggle("cycle", playing);
      stage.style.setProperty("--split", playing ? "0%" : split + "%");
      meta.innerHTML = data[set].label + " sample " + (item + 1) + " of " + data[set].items.length +
                       " &middot; IoU <b>" + it.iou.toFixed(1) + "</b>";
      [].forEach.call(dtabs.children, function (b, i) { b.classList.toggle("active", i === set); });
      [].forEach.call(ftabs.children, function (b, i) { b.classList.toggle("active", i === frame); });
      thumbs.innerHTML = "";
      data[set].items.forEach(function (x, i) {
        var b = document.createElement("button");
        b.className = i === item ? "active" : "";
        b.innerHTML = '<img src="' + x.img + '" alt="sample ' + (i + 1) + '" loading="lazy">';
        b.onclick = function () { item = i; sync(); };
        thumbs.appendChild(b);
      });
    }

    function drag(e) {
      if (playing) return;
      var r = stage.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      split = Math.max(0, Math.min(100, (x / r.width) * 100));
      stage.style.setProperty("--split", split + "%");
    }
    var down = false;
    stage.addEventListener("mousedown", function (e) { down = true; drag(e); e.preventDefault(); });
    window.addEventListener("mousemove", function (e) { if (down) drag(e); });
    window.addEventListener("mouseup", function () { down = false; });
    stage.addEventListener("touchstart", function (e) { down = true; drag(e); }, { passive: true });
    stage.addEventListener("touchmove", function (e) { if (down) drag(e); }, { passive: true });
    stage.addEventListener("touchend", function () { down = false; });

    sync();
  }

  document.addEventListener("DOMContentLoaded", function () {
    reveal(); nav(); tables();
    fetch("assets/samples/manifest.json")
      .then(function (r) { return r.json(); })
      .then(viewer)
      .catch(function () {
        var r = document.getElementById("viewer");
        if (r) r.innerHTML = '<p class="note">The interactive viewer requires a web server. ' +
          'The same predictions are shown in the figures below.</p>';
      });
  });
})();
