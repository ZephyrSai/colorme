# ColorMe

https://zephyrsai.github.io/colorme/
A calm, browser-based coloring studio. Upload any image, it becomes an outline, then you can either color it region-by-region by hand, or watch it paint itself in zen mode. Realistic brush textures (pencil, crayon, watercolor, acrylic, oil, marker), synthesized brush-stroke sounds, and an ambient drone for background music — no external assets required.

100% client-side. Pure HTML/CSS/JS. No build step.

## Run locally

Just open `index.html` in a modern browser. Or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repo and push these files (`index.html`, `styles.css`, `app.js`).
2. In the repo settings, go to **Pages**.
3. Under **Build and deployment**, set:
   - Source: **Deploy from a branch**
   - Branch: `main` (or whichever you pushed to), folder: `/ (root)`
4. Save. After a minute or so, your site will be live at
   `https://<your-username>.github.io/<repo-name>/`.

That's it — no extra configuration needed.

## How to use

1. Click **Upload image** (top-right) or **Try sample**.
2. The image is processed into a clean outline.
3. **Manual mode**: pick a brush + a color, then click any region of the outline to fill it.
4. **Zen mode**: choose Zen, hit **Start zen painting**, and watch the hand paint everything for you with random pastel colors. Press **Stop** or `Esc` to end early.
5. Toggle **music** (top-right) for a soft ambient drone, and **sound effects** for brush strokes.
6. **Save image** exports your finished painting as a PNG.

## Tips

- The **Detail** slider controls how much fine line work makes it into the outline. Photos with busy textures usually look best at low/medium detail.
- The **Line weight** slider thickens the outline for a bolder, more child-friendly look.
- The brush textures shine most on watercolor, acrylic, and oil. Crayon and pencil add grain.
- Music starts soft and fades in over a couple seconds — give it a moment.

## Browser support

Works in any modern browser (Chrome, Firefox, Safari, Edge). Web Audio is required for sound but optional for the rest of the app.
