const RamiLevyScraper = require('./scrapers/RamiLevyScraper');

async function test() {
  console.log('🧪 מתחיל בדיקה...\n');

  try {
    const scraper = new RamiLevyScraper();
    
    console.log('Test 1: חיפוש "חלב" עם limit 10 (ברירת מחדל - 50 גלילות)');
    const products1 = await scraper.scrape('חלב', 10);
    console.log(`✅ נמצאו ${products1.length} מוצרים\n`);
    console.log('דוגמת מוצר:', products1[0], '\n');

    console.log('Test 2: חיפוש "לחם" עם יותר גלילות לקבלת יותר מוצרים');
    const scraper2 = new RamiLevyScraper();
    const products2 = await scraper2.scrape('לחם', null, 100); // 100 גלילות במקום 50
    console.log(`✅ נמצאו ${products2.length} מוצרים\n`);

    console.log('Test 3: חיפוש כללי (ללא מילת חיפוש) עם הרבה גלילות');
    const scraper3 = new RamiLevyScraper();
    const products3 = await scraper3.scrape('', null, 150); // 150 גלילות
    console.log(`✅ נמצאו ${products3.length} מוצרים סה"כ\n`);

    console.log('✅ כל הבדיקות עברו בהצלחה!');

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  test();
}