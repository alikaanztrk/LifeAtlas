# LifeAtlas — Codex başlangıç paketi

Bu paket kaynak kod değil, Codex'in uygulamayı adım adım geliştirmesi için hazırlanmış Markdown proje şartnameleridir. Uygulama adı LifeAtlas, sloganı Your life, mapped.

## Nasıl kullanılır?

1. Bilgisayarında boş bir `LifeAtlas` proje klasörü oluştur. ZIP içeriğini doğrudan bu klasöre çıkart; `AGENTS.md` ve `CODEX_PROMPT.md` kökte, `docs/` yanlarında olmalı. Mevcut projen varsa önce yedek al ve var olan talimatlarla birleştir; üzerine körlemesine yazma.
2. Codex'te bu klasörü aç (sadece ZIP'i sohbet eki olarak vermek yerine çalışma dizini olarak açman önerilir). Codex repo kökündeki `AGENTS.md` yönergelerini kullanabilir; diğer dosyaları da prompt açıkça okutuyor.
3. Aşağıdaki mesajı gönder. İlk görev Phase 0 + Phase 1 ile sınırlı. Sonrasında çalışan veri motorunu ve tasarımı kontrol et.
4. Bir sonraki aşamaya geçmek için örnek: `AGENTS.md ve PLAN.md'yi oku. Önce önceki fazın açık sorunlarını gider, ardından docs/07_ROADMAP.md içindeki Phase 2'yi uygula. Test et, PLAN.md'yi güncelle ve yayınlama.`

## Codex'e ilk mesaj (kopyala)

```text
Bu klasörde LifeAtlas uygulamasını geliştireceğiz. Önce AGENTS.md, CODEX_PROMPT.md, PLAN.md ve docs/ altındaki bütün Markdown dosyalarını oku. CODEX_PROMPT.md'deki ilk çalışma emrini uygula: Phase 0 ve Phase 1'i planla, gerçek kodu oluştur, sentetik fixture'larla çalıştır ve test et. Sadece plan veya ekran maketi üretip bırakma. PLAN.md'yi güncelle. Phase 1 sonunda çalışan özellikleri, test sonuçlarını, yerel çalıştırma komutlarını ve gerçek JSON ile doğrulama adımlarını Türkçe raporla. GitHub'a push/deploy yapma. Gerçek kişisel konum verilerini repo, log, fixture veya dış servislerde kullanma.
```

## Dosyalar

| Dosya | İçerik |
|---|---|
| AGENTS.md | Codex'in repo kuralları, gizlilik, kod standardı, çalışma akışı |
| CODEX_PROMPT.md | Master prompt, ilk çalışma emri ve kapsam |
| PLAN.md | Yaşayan plan, kararlar, test kanıtları ve ilerleme |
| docs/01_PRODUCT.md | Ürün kapsamı ve özellikler |
| docs/02_UI_UX.md | Özgün arayüz, tasarım sistemi ve ekranlar |
| docs/03_ARCHITECTURE.md | Teknik mimari, yerel depolama, worker ve harita |
| docs/04_DATA_ENGINE.md | JSON biçimleri, algoritmalar, veri kalitesi |
| docs/05_PRIVACY.md | Gizlilik, güvenlik ve açık kaynak kuralları |
| docs/06_TESTING.md | Test matrisi ve yayın kabul kriterleri |
| docs/07_ROADMAP.md | 6 geliştirme fazı ve onay kapıları |
| docs/08_REFERENCES.md | GitHub örnekleri, kaynaklar, lisans kontrolleri |

## Önemli varsayımlar

- Chrome'da açılan statik web uygulaması; uzantı değil. PWA son aşamada.
- İlk varsayılan gizlilik modu çevrimiçi harita servislerini kapatır. Kullanıcı isterse çevrimiçi haritayı açıkça etkinleştirir. Harita istekleri yaklaşık görüntülenen bölgeyi sağlayıcıya gösterebilir.
- Gerçek JSON örneği ve boyutu henüz bilinmiyor. Şartname örnek şemalar ve sentetik fixture'lar tanımlar; gerçek dosya uyumluluğu henüz doğrulanmadı. Dosyanı GitHub'a koyma; uygulama hazır olduğunda bilgisayarında yerel import ile dene.
- MIT lisansı öneridir; isim/marka uygunluğu ve bağımlılık lisansları yayın öncesi kontrol edilmeli. Referans projeler çalıştırılıp denetlenmedi.
- Tasarım renkleri, teknoloji ayrıntıları ve faz sınırları başlangıç önerileridir; değişiklikler PLAN.md'de kayıt altına alınabilir. Kod henüz oluşturulmadı, testler çalıştırılmadı.
