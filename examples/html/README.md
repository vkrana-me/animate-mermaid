# Plain HTML example

No bundler and no `npm install`. Mermaid loads from a CDN through an import map.

```bash
# from the repo root
npm run build
python3 -m http.server 8080
# open http://localhost:8080/examples/html/
```

Any static server works. Opening the file directly (`file://`) won't, because browsers block ES modules there.
