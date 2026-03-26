# 📊 IMAGE DISPLAY PROBLEM - EXECUTIVE SUMMARY

## 🔴 ROOT CAUSE

```
Obrázky se NAHRAJÍ do MySQL/PostgreSQL, ale v galerii se NEZOBRAZUJÍ
```

**Důvod:** Obrázky bez `is_primary = true` se v SELECT queryích **nevybírají**

---

## 🔍 DETAIL PROBLÉMU

### Obrázek se nahraje takto:
```
┌─────────────────────────────────────────┐
│ User v ArtworkImageManager              │
│ ┌─────────────────────────────────────┐ │
│ │ ☐ Nastavit jako hlavní obrázek      │ │  ← DEFAULT UNCHECKED
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
            ↓
Frontend: fetch POST /api/upload/{artworkId}
            ↓
Multer uloží: /app/uploads/name-timestamp-random.jpg
            ↓
Backend vrátí: { imageUrl: "http://localhost:4777/uploads/..." }
            ↓
Frontend: fetch POST /api/artworks/{artworkId}/images
Body: { imageUrl: "...", isPrimary: false }  ← KLÍČOVÝ PROBLÉM!
            ↓
INSERT artwork_images (artwork_id, image_url, is_primary, display_order)
VALUES (123, "http://...", FALSE, 0)
            ↓
PostgreSQL artwork_images tabel
┌────┬──────────────┬──────────────────────────────────────────┬────────────┐
│ id │ artwork_id   │ image_url                                │ is_primary │
├────┼──────────────┼──────────────────────────────────────────┼────────────┤
│ 1  │ 123          │ http://localhost:4777/uploads/art-1-a.jpg│ FALSE      │
│ 2  │ 123          │ http://localhost:4777/uploads/art-2-b.jpg│ FALSE      │
│ 3  │ 123          │ http://localhost:4777/uploads/art-3-c.jpg│ FALSE      │
└────┴──────────────┴──────────────────────────────────────────┴────────────┘
                           ↓
         ❌ VŠECHNY OBRÁZKY MAJÍ is_primary = FALSE!
```

---

### Obrázky se v galerii vyhledávají takto:

```javascript
// backend/src/artworks.js - GET /api/artworks/by-author/:authorId
SELECT 
  a.id, a.title, a.description,
  CASE 
    WHEN ai.image_url IS NOT NULL THEN ai.image_url
    ELSE NULL
  END as image_url,  ← VRÁTÍ OBRÁZEK JENOM KDYŽ:
  ...
FROM artworks a
LEFT JOIN artwork_images ai 
  ON a.id = ai.artwork_id 
  AND ai.is_primary = true   ← ⚠️ PODMÍNKA: MUSÍ BÝT PRIMARY!
WHERE a.author_id = $1
```

**Výsledek:**
```
Artwork ID 123: image_url = NULL
                (protože ai.is_primary = true SELECT nefinduje žádný řádek)
```

---

## 📋 VŠECHNY POSTIŽENÉ QUERY ENDPOINTS

| Endpoint | Soubor | Řádek | Problém |
|----------|--------|-------|---------|
| `GET /api/artworks` | artworks.js | 103 | `LEFT JOIN artwork_images ai ON ... AND **ai.is_primary = true**` |
| `GET /api/artworks/by-author/:authorId` | artworks.js | 614 | `LEFT JOIN artwork_images ai ON ... AND **ai.is_primary = true**` |
| `GET /api/artworks/by-owner/:ownerId` | artworks.js | 714 | `LEFT JOIN artwork_images ai ON ... AND **ai.is_primary = true**` |
| `GET /api/artworks/approved` | artworks.js | 349 | `LEFT JOIN artwork_images ai ON ... AND **ai.is_primary = true**` |
| `GET /api/auth/admin/artwork-approvals` | auth.js | 569 | `LEFT JOIN artwork_images ai ON ... AND **ai.is_primary = true**` |

---

## 🗂️ SOUBORY KE KONTROLE

### Frontend (React/TypeScript)
```
frontend/src/components/
├── ArtworkImageManager.tsx      ← Upload komponenta
│                                 • Checkbox "Nastavit jako hlavní" (DEFAULT FALSE)
│                                 • POST /api/upload/{artworkId}
│                                 • POST /api/artworks/{artworkId}/images
│
├── ArtworkList.tsx              ← Renderování obrázků
├── UserGalleryBrowser.tsx       ← Renderování obrázků
├── ArtworksByUser.tsx           ← Renderování obrázků
├── FilteredArtworkList.tsx      ← Renderování obrázků
└── UserFilteredArtworkList.tsx  ← Renderování obrázků

frontend/src/api/
├── images.ts                    ← addArtworkImage() API
└── artworks.ts                  ← fetchArtworks() API
```

### Backend (Node.js/Express)
```
backend/src/
├── uploads.js                   ← POST /api/upload
│                                 • Multer configuraace
│                                 • Static serving na /uploads
│
├── artworks.js                  ← ALL GET/POST/PUT/DELETE
│                                 • 5 problematic SELECT queries
│                                 • Image upload/update/delete logic
│
├── index.js                     ← Express setup
│                                 • app.use('/uploads', express.static(...))
│                                 • CORS, middleware setup
│
├── auth.js                      ← Admin artwork approvals
│                                 • GET /api/auth/admin/artwork-approvals
│                                 • 1x problematic SELECT query
│
└── migrations/
    └── 007_artwork_images.sql   ← Database schema
                                   • CREATE TABLE artwork_images
                                   • is_primary BOOLEAN DEFAULT false
```

### Database (PostgreSQL)
```
artwork_images table:
┌──────────┬──────────────┬──────────────┬────────────┬──────────────┐
│ id       │ artwork_id   │ image_url    │ is_primary │ display_order│
│ SERIAL   │ INT FK       │ VARCHAR(255) │ BOOLEAN ✗  │ INT          │
│          │              │              │ DEFAULT=0  │              │
└──────────┴──────────────┴──────────────┴────────────┴──────────────┘
```

### Docker
```
docker-compose.yml:
backend:
  volumes:
    - ./backend/uploads:/app/uploads  ← Volume je správně mountnuta
```

---

## 📡 KOMPLETNÍ CALL CHAIN - Od nahrání až k vykreslení

```
┌─ UPLOAD FLOW ─────────────────────────────────────────────────┐
│                                                                 │
│ 1. ArtworkImageManager.tsx                                     │
│    └─ inputType="file" onChange → setImageFile()              │
│    └─ handleAddImage()                                        │
│                                                                 │
│ 2. fetch POST /api/upload/{artworkId}                         │
│    ├─ Headers: Authorization: Bearer {token}                  │
│    ├─ Body: FormData { file }                                 │
│    │                                                            │
│ 3. backend/src/uploads.js                                     │
│    ├─ verifyToken middleware                                   │
│    ├─ multer.single('file')                                   │
│    ├─ storage.diskStorage → /app/uploads/                     │
│    ├─ filename: `${name}-${timestamp}-${random}${ext}`        │
│    └─ response: { imageUrl, filename, artworkId }             │
│                                                                 │
│ 4. express.static('/uploads')                                 │
│    └─ Maps /app/uploads/* → http://localhost:4777/uploads/*  │
│                                                                 │
│ 5. fetch POST /api/artworks/{artworkId}/images                │
│    ├─ Headers: Authorization: Bearer {token}                  │
│    ├─ Body: { imageUrl, isPrimary: false/true }               │
│    │                                                            │
│ 6. backend/src/artworks.js                                    │
│    ├─ authenticateToken                                        │
│    ├─ Check artwork ownership                                  │
│    ├─ If isPrimary=true: UPDATE artwork_images SET is_primary=false │
│    ├─ INSERT artwork_images                                   │
│    └─ RETURNING: { id, artwork_id, image_url, is_primary } │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌─ DISPLAY FLOW ────────────────────────────────────────────────┐
│                                                                 │
│ 1. UserGalleryBrowser.tsx                                     │
│    ├─ useEffect → loadArtworksForUser(selectedUser)           │
│    │                                                            │
│ 2. axios.get /api/artworks/by-author/{userId}?status=...     │
│    │                                                            │
│ 3. backend/src/artworks.js                                    │
│    ├─ SELECT a.id, a.title, a.description,                   │
│    │        CASE WHEN ai.image_url IS NOT NULL THEN          │
│    │             ... prepend http://localhost:4777            │
│    │        END as image_url                                  │
│    │                                                            │
│    ├─ FROM artworks a                                         │
│    ├─ LEFT JOIN artwork_images ai                            │
│    │            ON a.id = ai.artwork_id                       │
│    │            AND ai.is_primary = true  ← ⚠️ PODMÍNKA!     │
│    │                                                            │
│    ├─ WHERE a.author_id = $1                                  │
│    │                                                            │
│    └─ RESULT:                                                 │
│        ✅ IF ai.is_primary = true:  image_url = populated     │
│        ❌ IF ai.is_primary = false: image_url = NULL          │
│                                                                 │
│ 4. Response: [{ id, title, image_url }, ...]                │
│    │                                                            │
│ 5. setArtworks(data)                                           │
│    │                                                            │
│ 6. Rendering v galerii:                                       │
│    └─ <img src={art.imageUrl} />                             │
│        ✅ src={populated} → obrázek viditelný                 │
│        ❌ src={null}      → prázdné místo                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 VISUAL IMPACT

### ❌ KDYŽ je `is_primary = false` (Current State):
```
┌─────────────────────────────────┐
│  GALERIE - Artwork Thumbnail    │
├─────────────────────────────────┤
│                                 │
│   [PRÁZDNÉ MÍSTO]               │  ← Uživatel viděl chybI!
│   (src={null} nebo src="")      │
│                                 │
├─────────────────────────────────┤
│ Title: My Beautiful Painting    │
│ Price: 5000 Kč                  │
└─────────────────────────────────┘
```

### ✅ KDYŽ je `is_primary = true` (Expected):
```
┌─────────────────────────────────┐
│  GALERIE - Artwork Thumbnail    │
├─────────────────────────────────┤
│                                 │
│   ┌─────────────────────────┐   │
│   │   [OBRÁZEK VIDITELNÝ]   │   │
│   │                         │   │
│   │   Malba na plátně       │   │
│   │   1200×800px            │   │
│   └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│ Title: My Beautiful Painting    │
│ Price: 5000 Kč                  │
└─────────────────────────────────┘
```

---

## 🔧 JEDNOTLIVÉ BODY K FIXU

1. **Option A: Automaticky nastavit first image jako primary**
   ```sql
   -- Backfill migration
   UPDATE artwork_images ai SET is_primary = true
   WHERE ai.id IN (
     SELECT MIN(id) FROM artwork_images GROUP BY artwork_id
   );
   ```

2. **Option B: Změnit frontend - auto-check "Set as primary"**
   ```typescript
   const [isPrimary, setIsPrimary] = useState(true);  // ← Default TRUE
   ```

3. **Option C: Relaxovat SQL query - vezmi první obrázek bez ohledu na is_primary**
   ```sql
   LEFT JOIN artwork_images ai 
     ON a.id = ai.artwork_id
     AND ai.display_order = (
       SELECT MIN(display_order) FROM artwork_images 
       WHERE artwork_id = a.id
     )
   ```

---

## 📌 SOUHRNNÉ STATISTIKY

| Metrika | Hodnota |
|---------|---------|
| Problematických SQL queryí | 5 |
| Frontend komponent renderující obrázky | 6 |
| Backend endpoints ovlivnených | 5 |
| Kritičnost problému | 🔴 HIGH |
| Dopad na UX | Obrázky se nekedy/nikdy nezobrazují |
| Root cause complexity | Jednoduchá - chybí IS_PRIMARY logika |

---

**Analýza dokončena:** 26.3.2026
