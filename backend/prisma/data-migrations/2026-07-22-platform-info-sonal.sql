-- Dátová migrácia (krok 30): nový prevádzkovateľ platformy + SK DPH 23 %.
-- Predchádzajúci obsah: legalName 'TicketAll s.r.o.', všetky identifikátory prázdne,
-- defaultVatRateSk 20.00. ENV PLATFORM_LEGAL_NAME ('MaceT s.r.o.') zrušené.
--
-- IBAN zámerne NEVYPĹŇAME – zatiaľ nie je známy. Na faktúre sa riadok s IBAN
-- jednoducho nevytlačí, kým ho niekto nedoplní v /admin/platform-info.
UPDATE "PlatformInfo" SET
  "legalName"        = 'Sonal s. r. o.',
  "ico"              = '56162375',
  "dic"              = '2122228449',
  "icDph"            = 'SK2122228449',
  "addressStreet"    = 'Mostná 13',
  "addressCity"      = 'Nitra',
  "addressZip"       = '949 01',
  "addressCountry"   = 'SK',
  "registrationNote" = 'Zapísaná v Obchodnom registri Okresného súdu Nitra, oddiel: Sro, vložka č. 63064/N',
  "contactEmail"     = 'info@ticketall.eu',
  "defaultVatRateSk" = 23.00,
  "updatedAt"        = now();
