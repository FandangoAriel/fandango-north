# ציוד חוות פאנדנגו בצפון

אפליקציית מובייל לדיווח מלאי ולהעמסה מהמחסן המרכזי, לשלושת האתרים: בית העמק, להבות חביבה וכפר חסידים. עד 10 עובדים. הבסיס הוא גיליון [ציוד לחוות פאנדנגו בצפון](https://docs.google.com/spreadsheets/d/1EgL_CEVPJHM3DmPElzR4hPJGGGMo4yQIHrucKhdN6XI/edit).

בלי מפתחות גוגל האפליקציה רצה במצב דמו עם הנתונים שכבר יובאו מהגיליון.

## הרצה מקומית

```bash
npm install
npm run dev
```

השרת עולה ב־[http://127.0.0.1:43187](http://127.0.0.1:43187). בטלפון: בחירת שם, בחירת חווה, ואז דיווח מלאי או צ'קליסט העמסה.

אפשר גם:

```bash
npx netlify-cli dev
```

## פריסה לנטליפיי

```bash
npm run build
npx netlify-cli deploy --prod
```

או חיבור הריפו לנטליפיי (build command: `npm run build`, publish: `dist`).

## חיבור לגיליון החי

1. צרו חשבון שירות ב-Google Cloud עם Google Sheets API.
2. שתפו את הגיליון עם כתובת ה-service account כ-Editor.
3. הוסיפו בנטליפיי (Site settings → Environment variables):
   - `SPREADSHEET_ID` — מזהה הגיליון
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — כל ה-JSON של חשבון השירות
4. טאב `משתמשים` (עמודה A, עד 10 שמות) וטאב `העמסות` ליומן.

בלי המשתנים האלה נשמרים דיווחים והעמסות מקומית (`.data/store.json` בפיתוח).
