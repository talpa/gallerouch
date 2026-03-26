# 🔍 ANALÝZA PROBLÉMU S NEZOBRAZENÍM OBRÁZKŮ V GALERII

**Datum analýzy:** 26.3.2026  
**Status:** ⚠️ KRITICKÝ PROBLÉM IDENTIFIKOVÁN

---

## 1. UPLOAD FLOW - Jak se obrázky nahrávají

### 1.1 Frontend Upload (`ArtworkImageManager.tsx`)
**Soubor:** [frontend/src/components/ArtworkImageManager.tsx](frontend/src/components/ArtworkImageManager.tsx#L54-L85)

```typescript
// 1. User vybere soubor a klikne "Nahrát obrázek"
const handleAddImage = async (e: React.FormEvent) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  // 2. POST na backend endpoint
  const uploadRes = await fetch(`/api/upload/${artworkId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  
  const { imageUrl } = await uploadRes.json();
  
  // 3. VOLÁ addArtworkImage API - obrázek se ULOŽÍ DO DB
  const addedImage = await addArtworkImage(token, artworkId, imageUrl, isPrimary);
};
```

**Problém 1️⃣:** Checkbox `isPrimary` je standardně `false` → obrázek se nahraje, ale **NIKDY NEBUDE PRIMARY**!

---

### 1.2 Backend Upload (`backend/src/uploads.js`)

**Soubor:** [backend/src/uploads.js](backend/src/uploads.js#L59-L69)

```javascript
// Upload endpoint - vrací absolutní URL
router.post('/upload/:artworkId', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imageUrl = `http://localhost:4777/uploads/${req.file.filename}`;
  res.json({ imageUrl, filename: req.file.filename, artworkId });
});

// Serve static files ze složky
router.use(express.static(uploadsDir, { maxAge: '1d' }));
```

**Jak se nahrává:**
- Multer uloží soubor do `backend/uploads/` s názvem `{name}-{timestamp}-{random}.{ext}`
- Vrátí absolutní URL: `http://localhost:4777/uploads/{filename}`

---

### 1.3 Uložení do DB (`backend/src/artworks.js`)

**Endpoint:** `POST /api/artworks/:id/images`  
**Soubor:** [backend/src/artworks.js](backend/src/artworks.js#L1037-L1092)

```javascript
router.post('/artworks/:id/images', authenticateToken, async (req, res) => {
  const { imageUrl, isPrimary } = req.body;  // ← Přijímá isPrimary z frontendu
  
  // Pokud isPrimary = true, unset ostatní
  if (isPrimary) {
    await client.query(
      'UPDATE artwork_images SET is_primary = false WHERE artwork_id = $1',
      [id]
    );
  }
  
  // INSERT do artwork_images
  const result = await client.query(
    `INSERT INTO artwork_images (artwork_id, image_url, is_primary, display_order)
     VALUES ($1, $2, $3, $4)`,
    [id, imageUrl, isPrimary || false, nextOrder]
  );
});
```

**KRITICKÝ PROBLÉM:** Když se obrázek nahraje **bez zaškrtnutí "Nastavit jako hlavní"**:
- `isPrimary = false` → obrázek se uloží s `is_primary = false`
- Obrázek je uložen v DB, ale nebude vybrán v galerií!

---

## 2. DISPLAY FLOW - Jak se obrázky vykreslují v galerii

### 2.1 Frontend Rendering

**Komponenty které renderují obrázky:**
- [ArtworkList.tsx](frontend/src/components/ArtworkList.tsx#L365)
- [UserGalleryBrowser.tsx](frontend/src/components/UserGalleryBrowser.tsx#L322)
- [ArtworksByUser.tsx](frontend/src/components/ArtworksByUser.tsx#L324)
- [FilteredArtworkList.tsx](frontend/src/components/FilteredArtworkList.tsx#L302)

```typescript
// Renderování v gallery
<img src={art.imageUrl} alt={art.title} className="card-image" />

// Renderování v detail
<Card.Img 
  variant="top" 
  src={image.imageUrl} 
  alt="Artwork" 
  className="image-thumbnail"
/>
```

Obrázek se renderuje z pole `art.imageUrl`, které přichází z API responses.

---

### 2.2 Backend API - GET /api/artworks

**Soubor:** [backend/src/artworks.js](backend/src/artworks.js#L62-L116)

```javascript
router.get('/api/artworks', async (req, res) => {
  const result = await client.query(`
    SELECT 
      a.id, a.title, a.description,
      ...
      CASE 
        WHEN ai.image_url IS NOT NULL THEN 
          CASE 
            WHEN ai.image_url LIKE 'http%' THEN ai.image_url
            ELSE 'http://localhost:4777' || ai.image_url
          END
        ELSE NULL
      END as image_url,
      ...
    FROM artworks a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN users author ON a.author_id = author.id
    LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
    LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
              ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
              PODMÍNKA: POUZE PRIMARY OBRÁZKY!
  `);
});
```

🔴 **KRITICKÁ CHYBA:** Query vrací obrázky **POUZE pokud `is_primary = true`**

---

### 2.3 Backend API - GET /api/artworks/by-author/:authorId

**Soubor:** [backend/src/artworks.js](backend/src/artworks.js#L565-L637)

```javascript
router.get('/artworks/by-author/:authorId', async (req, res) => {
  const result = await client.query(`
    SELECT 
      a.id, a.title, a.description,
      CASE 
        WHEN ai.image_url IS NOT NULL THEN 
          CASE 
            WHEN ai.image_url LIKE 'http%' THEN ai.image_url
            ELSE 'http://localhost:4777' || ai.image_url
          END
        ELSE NULL
      END as image_url,
      ...
    FROM artworks a
    LEFT JOIN artwork_types at ON a.artwork_type_id = at.id
    LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
              ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
              PODMÍNKA: POUZE PRIMARY OBRÁZKY!
    WHERE a.author_id = $1
  `);
});
```

🔴 **STEJNÝ PROBLÉM** v dalších endpointech:
- `GET /api/artworks/by-owner/:ownerId` - [řádek 714](backend/src/artworks.js#L714)
- `GET /api/artworks/approved` - [řádek 349](backend/src/artworks.js#L349)
- `GET /api/auth/admin/artwork-approvals` - [auth.js řádek 569](backend/src/auth.js#L569)

---

## 3. DATABASE STRUKTURA

**Soubor:** [backend/migrations/007_artwork_images.sql](backend/migrations/007_artwork_images.sql)

```sql
CREATE TABLE artwork_images (
  id SERIAL PRIMARY KEY,
  artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  image_url VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,  ← DEFAULT JE FALSE!
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_artwork_images_is_primary ON artwork_images(artwork_id, is_primary);
```

---

## 4. EXPRESS STATIC SERVING

**Soubor:** [backend/src/index.js](backend/src/index.js#L42-L43)

```javascript
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

✅ Soubory jsou správně servírovány na `http://localhost:4777/uploads/{filename}`

---

## 5. DOCKER MOUNTS

**Soubor:** [docker-compose.yml](docker-compose.yml#L40-L44)

```yaml
backend:
  volumes:
    - ./backend/src:/app/src
    - ./backend/migrations:/app/migrations
    - ./backend/uploads:/app/uploads  ← Uploads složka je sdílená!
```

✅ Uploads složka je správně mountnuta.

---

## ⚠️ SOUHRN PROBLÉMU

### Root Cause:
1. Když se obrázek nahraje, je standardně nastaven `is_primary = false`
2. Všechny SELECT queries vracejí obrázky s podmínkou `ai.is_primary = true`
3. **Obrázek zůstane v DB, ale nebude se zobrazovat v galerii!**

### Scénáře:

#### ✅ FUNGUJE:
```
1. User nahraje obrázek
2. Zaškrtne "Nastavit jako hlavní obrázek"
3. isPrimary = true → uloží se s is_primary = true
4. SELECT query vybere obrázek
5. Obrázek se zobrazí!
```

#### ❌ NEFUNGUJE:
```
1. User nahraje obrázek
2. NEZAŠKRTNE "Nastavit jako hlavní obrázek"
3. isPrimary = false → uloží se s is_primary = false
4. SELECT query NEVYBERE obrázek (je v DB ale invisible!)
5. Galerie zobrazí NULL obrázek!
```

---

## 6. CALL CHAIN

### **Upload sekvence:**
```
ArtworkImageManager.tsx (Frontend)
  ↓
1. fetch POST /api/upload/{artworkId}  [multer, uloží soubor]
  ↓
2. Response: { imageUrl: "http://localhost:4777/uploads/filename" }
  ↓
3. fetch POST /api/artworks/{artworkId}/images  [uloží do DB]
  { imageUrl: "http://localhost:4777/uploads/filename", isPrimary: false }
  ↓
backend/src/artworks.js - POST /artworks/:id/images
  ↓
INSERT artwork_images (artwork_id, image_url, is_primary, display_order)
  ↓
PostgreSQL artwork_images tabel [is_primary = false]
```

### **Display sekvence:**
```
UserGalleryBrowser.tsx (Frontend)
  ↓
useEffect → loadArtworksForUser()
  ↓
axios.get /api/artworks/by-author/{userId}
  ↓
backend/src/artworks.js - GET /artworks/by-author/:authorId
  ↓
SELECT ... LEFT JOIN artwork_images ai ON ... AND ai.is_primary = true
  ↓
❌ Query NEBO VRÁTÍ NULL
   NEBO VRÁTÍ STARÝ PRIMARY OBRÁZEK
   (pokud byl někdy nastavený jako primary)
  ↓
{ ..., imageUrl: null } OR { ..., imageUrl: "http://localhost:4777/uploads/old-file" }
  ↓
<img src={art.imageUrl} />
  ↓
❌ Nedisponuje se nebo se zobrazí starý obrázek!
```

---

## 7. EXPRESS CESTY K SOUBORŮM

```
Frontend:
  http://localhost:8080
  └─ /api/upload/{artworkId}  → backend:4777

Backend:
  http://localhost:4777/uploads/
  └─ /uploads/{filename}  → app.use('/uploads', express.static(...))
  
Physical:
  /app/uploads/
  └─ {filename}  (v Docker kontejneru)
  
Mounted:
  ./backend/uploads/
  └─ {filename}  (na host machine)
```

---

## 8. IDENTIFIKOVANÉ DUPLICITNÍ ROUTES ⚠️

V `artworks.js` jsou **zdánlivě duplikované** GET endpoints:
- Řádek 118: `router.get('/artworks/authors', ...)`
- Řádek 421: `router.get('/artworks/authors', ...)`  ← DRUHÁ DEFINICE!

- Řádek 148: `router.get('/artworks/owners', ...)`
- Řádek 451: `router.get('/artworks/owners', ...)`  ← DRUHÁ DEFINICE!

↳ Express použije **POSLEDNÍ DEFINICI** (později v souboru)

---

## MAPA SOUBORŮ

```
Frontend:
├─ src/components/
│  ├─ ArtworkImageManager.tsx  (upload komponenta)
│  ├─ ArtworkList.tsx  (renderování)
│  ├─ UserGalleryBrowser.tsx  (renderování)
│  ├─ ArtworksByUser.tsx  (renderování)
│  ├─ FilteredArtworkList.tsx  (renderování)
│  └─ UserFilteredArtworkList.tsx  (renderování)
├─ src/api/
│  └─ images.ts  (API funkce addArtworkImage)
└─ src/api/artworks.ts  (fetchArtworks)

Backend:
├─ src/uploads.js  (POST /api/upload)
├─ src/artworks.js  (GET/POST /api/artworks/...)
├─ src/index.js  (Express staticserving)
└─ migrations/007_artwork_images.sql  (DB schema)

Docker:
└─ docker-compose.yml  (volumes mount)
```

---

## 🔧 ŘEŠENÍ (PRO DALŠÍ PRÁCI)

1. **AUTOMATICKY NASTAVIT PRVNÍ OBRÁZEK JAKO PRIMARY**
   - Při prvním nahrání automaticky nastavit `is_primary = true`
   - Nebo v JS komponenta defaultně zaškrtnout "Nastavit jako hlavní"

2. **FIX: UPDATE ARITCLES JI NEVYBÍRÁ SEKUNDÁRNÍ OBRÁZKY**
   - Změnit LEFT JOIN na: `LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true`
   - NEBO: vybrat PRVNÍ obrázek按 display_order, i když není primary

3. **BACKFILL MIGRACE**
   - SET `is_primary = true` pro první obrázek každého artwork:
   ```sql
   UPDATE artwork_images ai SET is_primary = true
   WHERE ai.id IN (
     SELECT DISTINCT ON (artwork_id) id 
     FROM artwork_images 
     ORDER BY artwork_id, display_order
   ) AND artwork_id NOT IN (
     SELECT artwork_id FROM artwork_images WHERE is_primary = true
   );
   ```

---

**Analýza kompletní.** Všechny relevantní soubory a datasety byly prověřeny.
