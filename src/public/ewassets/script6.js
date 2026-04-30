
    (function() {
      var preconnectOrigins = ["https://cdn.shopify.com"];
      var scripts = ["/cdn/shopifycloud/checkout-web/assets/c1/polyfills.CgsWKOqO.js","/cdn/shopifycloud/checkout-web/assets/c1/app.DTVVt24e.js","/cdn/shopifycloud/checkout-web/assets/c1/dist-vendor.C30Hmq0_.js","/cdn/shopifycloud/checkout-web/assets/c1/browser.EcpZ7d1M.js","/cdn/shopifycloud/checkout-web/assets/c1/shop-pay-FullScreenBackground.GMx9iwRQ.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-PaymentSessionMutation.ej9e9ymw.js","/cdn/shopifycloud/checkout-web/assets/c1/actions-shop-discount-offer.CY7bsCbW.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-alternativePaymentCurrency.DNeKTm8J.js","/cdn/shopifycloud/checkout-web/assets/c1/shared-unactionable-errors.9MsK7nBI.js","/cdn/shopifycloud/checkout-web/assets/c1/utils-BusinessCustomerShippingAddressManager.wVpt6n3G.js","/cdn/shopifycloud/checkout-web/assets/c1/helpers-shared.BKUoJObE.js","/cdn/shopifycloud/checkout-web/assets/c1/extensibility-useUnauthenticatedErrorModal.DiJVyshk.js","/cdn/shopifycloud/checkout-web/assets/c1/shop-pay-ButtonWithRegisterWebPixel.Btyt3hVH.js","/cdn/shopifycloud/checkout-web/assets/c1/payment-shared.Bsr2rX9R.js","/cdn/shopifycloud/checkout-web/assets/c1/images-flag-icon.C_eXYJRt.js","/cdn/shopifycloud/checkout-web/assets/c1/images-payment-icon.D2Fpq5Mq.js","/cdn/shopifycloud/checkout-web/assets/c1/locale-en.Dz25GVYk.js","/cdn/shopifycloud/checkout-web/assets/c1/page-OnePage.8-w72wVm.js","/cdn/shopifycloud/checkout-web/assets/c1/Captcha-MarketsProDisclaimer.B_LHWOxQ.js","/cdn/shopifycloud/checkout-web/assets/c1/Menu-CrossBorderConsolidation.DXxC5a7Q.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useSubscribeMessenger.BQdMcwF_.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useSuppressShopPayModalOnLoad.B3M9bnd_.js","/cdn/shopifycloud/checkout-web/assets/c1/types-useHasOrdersFromMultipleShops.o8IYqh2c.js","/cdn/shopifycloud/checkout-web/assets/c1/icons-ShopPayLogo.CbsW81Yn.js","/cdn/shopifycloud/checkout-web/assets/c1/BuyWithPrimeChangeLink-VaultedPayment.DgopWbVg.js","/cdn/shopifycloud/checkout-web/assets/c1/DeliveryMacros-ShippingGroupsSummaryLine.DrqXSNfA.js","/cdn/shopifycloud/checkout-web/assets/c1/MerchandisePreviewThumbnail-StackedMerchandisePreview.kxyYcyiO.js","/cdn/shopifycloud/checkout-web/assets/c1/Map-PickupPointCarrierLogo.dcEVJgvC.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks.7jRiJkWC.js","/cdn/shopifycloud/checkout-web/assets/c1/PostPurchaseShouldRender-LocalizationExtensionField.B2yKhf0k.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-ShopPayOptInDisclaimer.Bi_YZ8Ri.js","/cdn/shopifycloud/checkout-web/assets/c1/shopPaySessionTokenStorage-RememberMeDescriptionText.cT1vxHyc.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-MobileOrderSummary.T6c8XHZR.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-OrderEditVaultedDelivery.BF5MuO5p.js","/cdn/shopifycloud/checkout-web/assets/c1/captcha-SeparatePaymentsNotice.4vPxFp7Z.js","/cdn/shopifycloud/checkout-web/assets/c1/StockProblems-StockProblemsLineItemList.KxJyd8Qv.js","/cdn/shopifycloud/checkout-web/assets/c1/redemption-constants.DpsXlWQg.js","/cdn/shopifycloud/checkout-web/assets/c1/adapter-useShopPayPaymentRequiredMethod.8_-vAnkL.js","/cdn/shopifycloud/checkout-web/assets/c1/negotiated-ShipmentBreakdown.CihtA5Bl.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-MerchandiseModal.XqyOvqia.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-shipping-options.UOJZOTVI.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-DutyOptions.4iYTfkMS.js","/cdn/shopifycloud/checkout-web/assets/c1/DeliveryInstructionsFooter-ShippingMethodSelector.CkNqxqER.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-SubscriptionPriceBreakdown.D6WEo0sw.js"];
      var styles = ["/cdn/shopifycloud/checkout-web/assets/c1/assets/app.D8Rm0LuX.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/FullScreenBackground.CfHxiIwO.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/ButtonWithRegisterWebPixel.PaEnwh9S.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/shared.CEMlQpma.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/OnePage.BB2ha-x7.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/CrossBorderConsolidation.CvXXnYCy.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/LocalizationExtensionField.BGO83eR3.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/MobileOrderSummary.Cko1fUoG.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/OrderEditVaultedDelivery.CSQKPDv7.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/useSubscribeMessenger.BrcQzLuH.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/DutyOptions.LcqrKXE1.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/VaultedPayment.OxMVm7u-.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/PickupPointCarrierLogo.cbVP6Hp_.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/StackedMerchandisePreview.D6OuIVjc.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/ShippingMethodSelector.B0hio2RO.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/SubscriptionPriceBreakdown.BSemv9tH.css"];
      var fontPreconnectUrls = [];
      var fontPrefetchUrls = [];
      var imgPrefetchUrls = ["https://cdn.shopify.com/s/files/1/0706/0104/8365/files/imageedit_3_8640371745_300x300_084dd724-9033-48aa-8a67-8b714f3d7d7f_x320.png?v=1701024409"];

      function preconnect(url, callback) {
        var link = document.createElement('link');
        link.rel = 'dns-prefetch preconnect';
        link.href = url;
        link.crossOrigin = '';
        link.onload = link.onerror = callback;
        document.head.appendChild(link);
      }

      function preconnectAssets() {
        var resources = preconnectOrigins.concat(fontPreconnectUrls);
        var index = 0;
        (function next() {
          var res = resources[index++];
          if (res) preconnect(res, next);
        })();
      }

      function prefetch(url, as, callback) {
        var link = document.createElement('link');
        if (link.relList.supports('prefetch')) {
          link.rel = 'prefetch';
          link.fetchPriority = 'low';
          link.as = as;
          if (as === 'font') link.type = 'font/woff2';
          link.href = url;
          link.crossOrigin = '';
          link.onload = link.onerror = callback;
          document.head.appendChild(link);
        } else {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.onloadend = callback;
          xhr.send();
        }
      }

      function prefetchAssets() {
        var resources = [].concat(
          scripts.map(function(url) { return [url, 'script']; }),
          styles.map(function(url) { return [url, 'style']; }),
          fontPrefetchUrls.map(function(url) { return [url, 'font']; }),
          imgPrefetchUrls.map(function(url) { return [url, 'image']; })
        );
        var index = 0;
        function run() {
          var res = resources[index++];
          if (res) prefetch(res[0], res[1], next);
        }
        var next = (self.requestIdleCallback || setTimeout).bind(self, run);
        next();
      }

      function onLoaded() {
        try {
          if (parseFloat(navigator.connection.effectiveType) > 2 && !navigator.connection.saveData) {
            preconnectAssets();
            prefetchAssets();
          }
        } catch (e) {}
      }

      if (document.readyState === 'complete') {
        onLoaded();
      } else {
        addEventListener('load', onLoaded);
      }
    })();
  