# 🛠️ TECHNICAL DEBUGGING & TESTING GUIDE

## HOW TO VERIFY THE PROBLEM

### Step 1: Upload an Image WITHOUT Setting as Primary

1. Go to Admin Gallery Manager or User Gallery
2. Click "Edit" on any artwork or create new
3. Go to "Images" tab
4. Click "Vybrat soubor" and select image
5. **DO NOT CHECK** "Nastavit jako hlavní obrázek"
6. Click "Nahrát obrázek"

**Expected (Broken):**
- ✅ Upload completes successfully
- ❌ Image disappears from gallery
- ❌ Thumbnail shows empty/broken

**What Happened:**
- Image file saved: `/app/uploads/name-timestamp-random.jpg` ✅
- Image URL stored in DB: `http://localhost:4777/uploads/...` ✅
- DB record has `is_primary = false` ⚠️ **PROBLEM**

---

### Step 2: Check Database Directly

```bash
# Connect to PostgreSQL
docker exec -it gallerouch-db-1 psql -U gallerouch -d gallerouch

# Query the artwork_images table
SELECT * FROM artwork_images WHERE artwork_id = 123;

# Expected result:
# id |artwork_id|        image_url        |is_primary|display_order|created_at
# 1  |123       |http://.../art-1-a.jpg  |FALSE     |0            |...
# ^^ This is the PROBLEM - is_primary = FALSE
```

---

### Step 3: Check Frontend API Response

```javascript
// In Chrome DevTools Console
fetch('/api/artworks/by-author/1')
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))

// Look for imageUrl in response:
// ✅ GOOD:  { id: 123, title: "...", imageUrl: "http://localhost:4777/uploads/..." }
// ❌ BAD:   { id: 123, title: "...", imageUrl: null }
```

Or use Network tab:
1. Open DevTools → Network tab
2. Refresh gallery page
3. Look for `artworks/by-author/1` request
4. Check Response → `imageUrl` field

---

### Step 4: Check SQL Query Being Executed

```javascript
// In backend/src/artworks.js, add logging

console.log(`[DEBUG] Query:`, query);
console.log(`[DEBUG] Params:`, params);
console.log(`[DEBUG] Result:`, result.rows);

// You'll see:
// [DEBUG] Result: [
//   {
//     id: 123,
//     image_url: null   ← ⚠️ NULL because JOIN didn't match!
//   }
// ]
```

---

## THE EXACT SQL PROBLEMS

### Query 1: `/api/artworks`
**File:** `backend/src/artworks.js:62-116`

```sql
SELECT ... image_url ...
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
                                                         ↑ CONDITION

-- If no artwork_images record has is_primary=true:
-- Result: ai.image_url = NULL (LEFT JOIN with no match)
```

**Test:**
```sql
-- Run this query to see what the backend sees:
SELECT a.id, a.title, ai.image_url, ai.is_primary
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
WHERE a.id = 123;

-- Result when problem exists:
-- id |title |image_url|is_primary
-- 123|"Art" |NULL     |NULL       ← ⚠️ No row matched the JOIN condition!
```

**What Should Happen:**
```sql
-- After fix, this query should return image:
SELECT a.id, a.title, ai.image_url, ai.is_primary
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
WHERE a.id = 123;

-- Result (if primary image exists):
-- id |title |image_url                              |is_primary
-- 123|"Art" |http://localhost:4777/uploads/art.jpg  |TRUE
```

---

### Query 2: `/api/artworks/by-author/:authorId`
**File:** `backend/src/artworks.js:565-637`

```sql
SELECT ... image_url ...
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
WHERE a.author_id = $1
```

**Same problem as Query 1**

---

### Query 3: `/api/artworks/by-owner/:ownerId`
**File:** `backend/src/artworks.js:647-713`

```sql
SELECT ... image_url ...
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
WHERE a.user_id = $1
```

**Same problem**

---

### Query 4: `/api/artworks/approved`
**File:** `backend/src/artworks.js:314-373`

```sql
SELECT ... image_url ...
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
WHERE e.approved_at IS NOT NULL AND e.status = 'approved'
```

**Same problem**

---

### Query 5: `/api/auth/admin/artwork-approvals`
**File:** `backend/src/auth.js:514-600`

```sql
SELECT ... image_url ...
FROM artworks a
LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
WHERE [various filters]
```

**Same problem**

---

## FILE INSPECTION CHECKLIST

### ✓ Upload Component
- [ ] Check `ArtworkImageManager.tsx:30` - `isPrimary` default value
  ```typescript
  const [isPrimary, setIsPrimary] = useState(false);  // ← Should be true?
  ```

- [ ] Check `ArtworkImageManager.tsx:75` - checkbox state
  ```typescript
  <Form.Check
    type="checkbox"
    label="Nastavit jako hlavní obrázek"
    checked={isPrimary}  // ← Starts unchecked
  />
  ```

### ✓ Backend Upload
- [ ] Check `uploads.js:59-69` - upload response
  ```javascript
  res.json({ imageUrl, filename: req.file.filename, artworkId });
  // ✅ Returns imageUrl correctly
  ```

### ✓ Backend Image Storage
- [ ] Check `artworks.js:1037-1092` - INSERT logic
  ```javascript
  [id, imageUrl, isPrimary || false, nextOrder]
  //                        ↑ DEFAULT FALSE if not provided
  ```

### ✓ Backend Query Conditions
- [ ] Check `artworks.js:103` - condition
  ```sql
  LEFT JOIN artwork_images ai ON a.id = ai.artwork_id AND ai.is_primary = true
  ```

- [ ] Check `artworks.js:614` - condition (same)
- [ ] Check `artworks.js:714` - condition (same)
- [ ] Check `artworks.js:349` - condition (same)
- [ ] Check `auth.js:569` - condition (same)

### ✓ Database Schema
- [ ] Check `migrations/007_artwork_images.sql:6`
  ```sql
  is_primary BOOLEAN DEFAULT false,  // ← Default FALSE
  ```

### ✓ Express Static Serving
- [ ] Check `index.js:43`
  ```javascript
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  // ✅ Correctly serves /uploads/* to http://localhost:4777/uploads/*
  ```

### ✓ Docker Volumes
- [ ] Check `docker-compose.yml:42`
  ```yaml
  - ./backend/uploads:/app/uploads  # ✅ Correctly mounted
  ```

---

## DETAILED FLOW DEBUGGING

### When Uploading Image to DB:

```javascript
// ArtworkImageManager.tsx:71-78
const uploadRes = await fetch(`/api/upload/${artworkId}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});

// ✅ Here we get: { imageUrl: "http://localhost:4777/uploads/file-123-abc.jpg" }

const { imageUrl } = await uploadRes.json();

// ❌ PROBLEM: isPrimary = false (default from state)
const addedImage = await addArtworkImage(token, artworkId, imageUrl, isPrimary);

// This calls:
// POST /api/artworks/{artworkId}/images
// Body: { imageUrl: "http://...", isPrimary: false }

// Backend receives and inserts:
// INSERT artwork_images (..., is_primary)
// VALUES (..., false)   ← ⚠️ PROBLEM STARTS HERE
```

### When Fetching Artworks for Gallery:

```typescript
// UserGalleryBrowser.tsx:120-128
const loadArtworksForUser = async (selectedUser: User) => {
  const response = await axios.get(
    `/api/artworks/by-author/${selectedUser.id}`
  );
  setArtworks(response.data);
};

// Backend query executes:
// SELECT ... image_url FROM artworks a
// LEFT JOIN artwork_images ai ON ... AND ai.is_primary = true
// WHERE a.author_id = $1

// If ai.is_primary = true condition finds NO rows:
// Result: { ..., image_url: null }

// Frontend renders:
// <img src={null} alt={title} />  ← Broken image!
```

---

## TESTING SCENARIOS

### Scenario 1: Upload WITHOUT Primary (Broken)
```
1. Upload image → isPrimary = false
2. Check DB: is_primary = FALSE ❌
3. Query SELECT: No match, image_url = NULL ❌
4. Frontend: <img src={null} /> ❌
5. Gallery: Blank space ❌
```

### Scenario 2: Upload WITH Primary (Works)
```
1. Check checkbox
2. Upload image → isPrimary = true
3. Check DB: is_primary = TRUE ✅
4. Query SELECT: Matches, image_url = populated ✅
5. Frontend: <img src={imageUrl} /> ✅
6. Gallery: Image visible ✅
```

### Scenario 3: Update Existing Image to Primary
```
1. Image already in DB with is_primary = false
2. Click "Nastavit jako hlavní"
3. Call PUT /api/artworks/{id}/images/{imageId}
   Body: { isPrimary: true }
4. Backend: UPDATE artwork_images SET is_primary = true
5. Query refreshes: Now finds image ✅
6. Gallery updates: Image appears ✅
```

---

## LOGGING TO ADD FOR DEBUGGING

**File:** `backend/src/artworks.js`

```javascript
// Around line 1037 - POST /artworks/:id/images
console.log(`[Upload] Received isPrimary:`, isPrimary);
console.log(`[Upload] Will insert with is_primary:`, isPrimary || false);

// Around line 1025 - GET /artworks/:id/images
console.log(`[Fetch] Images for artwork:`, id);
console.log(`[Fetch] Result:`, result.rows);

// Around line 75 - GET /artworks
console.log(`[AllArtworks] Total artworks:`, result.rows.length);
result.rows.forEach(r => {
  console.log(`  - Artwork ${r.id}: imageUrl = ${r.image_url ? 'SET' : 'NULL'}`);
});
```

**File:** `frontend/src/components/ArtworkImageManager.tsx`

```typescript
// Around line 60
console.log('[Upload] Current isPrimary state:', isPrimary);

// Around line 85
console.log('[Upload] Response imageUrl:', imageUrl);
console.log('[Upload] Saving with isPrimary:', isPrimary);
```

---

## QUICK VERIFICATION COMMAND

```bash
# Connect to DB and count primary vs non-primary images
docker exec -it gallerouch-db-1 psql -U gallerouch -d gallerouch -c "
SELECT 
  is_primary, 
  COUNT(*) as count 
FROM artwork_images 
GROUP BY is_primary;
"

# Expected output if problem exists:
#  is_primary | count
# ────────────┼───────
#  f          | 15      ← Many non-primary images
#  t          | 2       ← Few or no primary images
```

---

**Debug Guide Complete - Use this to identify exact point of failure**
