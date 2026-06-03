(function () {
  function createCodeBackground() {
    const codeBg = document.querySelector("#code-bg");
    if (!codeBg) {
      return;
    }

    const baseTokens = [
      "const", "let", "await", "return", "map()", "push()", "fn()", "{}",
      "[]", "=>", "&&", "||", "if", "else", "while", "true", "false",
      "null", "void", "new", "class", "try", "catch", "import", "export",
      "tentacle()", "sucker[]", "mucus++", "fold.map()", "wet_try"
    ];
    const rareTokens = [
      "💩", "s + h + i + t", "<shit/>", "{shit:true}", "sh_it++",
      "return 💩", "s.h.i.t()", "/* shit */", "shit.map()"
    ];
    const codePoops = [
      "  +\n+  +\n + +\n+     +",
      "  ++\n +  +\n+ ++ +\n ++++",
      "   +\n  +++\n + + +\n+  +  +",
      " +++\n+ + +\n +++\n+   +"
    ];
    const sacredTokens = ["✦", "tiny_cross()", "GLORIA", "sanctus()", "✧"];

    codeBg.replaceChildren();
    const width = window.innerWidth || 1024;
    const streamCount = width < 720 ? 18 : 34;

    for (let i = 0; i < streamCount; i += 1) {
      const stream = document.createElement("div");
      stream.className = "code-stream";
      stream.style.left = `${(i / streamCount) * 100 + Math.random() * 2.2}%`;
      stream.style.animationDuration = `${18 + Math.random() * 24}s`;
      stream.style.animationDelay = `${Math.random() * -32}s`;
      stream.style.opacity = `${0.58 + Math.random() * 0.3}`;

      const tokenCount = 30 + Math.floor(Math.random() * 18);
      for (let j = 0; j < tokenCount; j += 1) {
        const token = document.createElement("span");
        const roll = Math.random();

        if (roll < 0.008) {
          token.textContent = sacredTokens[Math.floor(Math.random() * sacredTokens.length)];
          token.className = "code-token sacred";
        } else if (roll < 0.042) {
          token.textContent = codePoops[Math.floor(Math.random() * codePoops.length)];
          token.className = "code-token code-poop";
        } else {
          const isRare = roll < 0.14;
          const values = isRare ? rareTokens : baseTokens;
          token.textContent = values[Math.floor(Math.random() * values.length)];
          token.className = `code-token${isRare ? (token.textContent === "💩" || token.textContent.includes("💩") ? " poop" : " code-shit") : ""}`;
        }

        token.style.setProperty("--tilt", `${Math.random() * 8 - 4}deg`);
        stream.append(token);
      }

      codeBg.append(stream);
    }
  }

  let backgroundResizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(backgroundResizeTimer);
    backgroundResizeTimer = window.setTimeout(createCodeBackground, 180);
  });

  window.YourSheetBackground = { create: createCodeBackground };
})();
