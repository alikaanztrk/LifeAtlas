# LifeAtlas — Codex master prompt

Bu dosya proje sahibinin Codex'e vereceği ana görevdir. `AGENTS.md` ve `docs/` klasörü ile birlikte repo kökünde bulunmalıdır.

## Görev

LifeAtlas isimli, Google Maps Timeline dışa aktarma JSON dosyalarını yerel olarak işleyen, çok kaliteli ve yayınlanabilir bir açık kaynak web uygulaması geliştir. Bunu basit bir harita görüntüleyicisi değil, kişisel konum geçmişi, seyahat günlüğü ve veri analizi platformu olarak ele al. Ürün Google Timeline'ın günlük ayrıntısını, modern bir analitik panelin işlevselliğini ve Wrapped benzeri yıllık özetlerin hikâye anlatımını bir araya getirmeli. Başka bir markanın arayüzünü birebir taklit etme.

Öncelik: masaüstü Chrome, modern responsive UI, güvenilir veri motoru, açık kaynak yayınlanabilirliği, yerel veri gizliliği. Uygulama adı LifeAtlas; sloganı Your life, mapped. İngilizce ve Türkçe arayüz. Kullanıcı hiçbir hesap oluşturmadan ve kendi API anahtarını almadan temel uygulamayı kullanabilmeli. Sunucu kurma.

## Çalışma biçimi

- Önce `AGENTS.md` ve `docs/` altındaki tüm şartnameleri oku; `PLAN.md` dosyasını yaşayan proje planı olarak kullan.
- Mevcut dizini incele. Boşsa Phase 0'dan başla; doluysa önce var olan işlevleri koruyarak fark analizi yap.
- `docs/08_REFERENCES.md` içindeki projeleri teknik ve UX referansı olarak kullan. Kaynak koda erişimin yoksa bunu belirt. Kod kopyalamadan önce lisans ve attribution kontrolü yap; varsayılan olarak sıfırdan yaz.
- Gerçek konum geçmişi örneği henüz şartname paketine dahil değildir. Önce sentetik Android/iOS/legacy fixture'larla geliştir. Kullanıcı daha sonra gerçek dosyayı yalnızca lokal import ile doğrulayacak. Bilinmeyen alanları tahmin ederek gerçek veri desteği iddia etme.
- Büyük ve riskli değişiklikleri aşamalara böl. Gereksiz sorularla akışı kesme; geri alınabilir kararları plan dosyasına yaz. Veri gizliliği, lisans, kapsam veya geri alınamaz işlem konusunda belirsizlik varsa onay iste.
- Her aşamada gerçek çalışan bir ürün bırak. Demo modu ayrı, gerçek veri akışı ayrı olsun. Sayfaları yalnızca ekran maketi olarak bırakma. Bir özellik henüz yapılmadıysa onu tamamlanmış gibi sunma.
- Repo içinde npm komutlarını çalıştır; testleri gerçek sonuçlarla raporla. GitHub'a kendiliğinden push veya deploy yapma.

## Öncelik sırası

1. Phase 0 — Proje iskeleti, tasarım sistemi, sentetik demo ve güvenlik politikası.
2. Phase 1 — Worker tabanlı JSON import, normalize etme, yerel veri saklama ve veri kalitesi raporu.
3. Phase 2 — Genel bakış, harita, gün zaman çizelgesi, takvim, ortak tarih filtresi.
4. Phase 3 — Mekânlar, seyahatler, analitik ve karşılaştırma.
5. Phase 4 — Yıllık/aylık hikâyeler, rota oynatma, güvenli çıktı.
6. Phase 5 — PWA, performans, erişilebilirlik, dokümantasyon, CI ve yayın hazırlığı.

## İlk çalışma emri

Bu prompt ile ilk açılışta Phase 0 ve Phase 1'i uygula. Önce dosya yapısını ve implementasyon planını oluştur, ardından kodu yaz, fixture'larla import akışını çalıştır, build ve testleri gerçekleştir. Phase 1 sonunda dur ve bana şunları Türkçe sun: çalışan özellikler, değişen dosyalar, test sonuçları, nasıl çalıştıracağım, gerçek JSON ile doğrulama adımı, kalan riskler ve Phase 2 için sonraki görev. Phase 2 veya sonraki fazlara ancak sonraki görevimde geç. Bu duraklama kuralı yayın kontrolü ve tasarım incelemesi içindir; ilk fazlarda yalnızca plan yazıp durma.

## Son teslim hedefi (tüm fazlar tamamlandığında)

- Chrome'da çalışan, JSON yükleyip gerçek hesaplamaları gösteren uygulama.
- Güvenilir veri motoru, orijinal premium tasarım, TR/EN, açık/koyu tema.
- Sentetik fixture'lar, otomatik testler, kullanım ve katkı dokümantasyonu.
- GitHub Pages için çalışır derleme ve CI yapılandırması; gerçek yayınlama için sahibin onayı.
- Hiçbir kişisel veriyi içermeyen temiz kaynak kod. README'de harita bağlantıları, desteklenen biçimler, doğruluk sınırları ve gizlilik modu açıklaması.
