(async () => {
	const html = await import('./html.js');
	const math = await import('./math.js');
	const helpers = await import('./helpers.js');
	const settings = await import('./settings.js');

	const ORDER_FORM_QUERY = 'div[name=orderForm]';
	const INPUT_PRICE_QUERY = 'input[id^="limitPrice"]';
	const POSITION_SIZE_QUERY = 'input[id^="unitAmount"]';
	const TAKE_PROFIT_QUERY = 'input[id^="takeProfitStopPrice"]';
	const STOP_LOSS_QUERY = 'input[id^="stopLossStopPrice"]';
	const LAST_PRICE_BTN_QUERY = 'div[data-bn-type=\'text\']';
	const UOM_QUERY = 'label[data-testid=\'unit-select-button\']';
	const LAST_PRICE_QUERY = '.ticker-wrap .draggableHandle';
	const TAB_MARKET_QUERY = '#tab-MARKET > .active';
	const TAB_LIMIT_QUERY = '#tab-LIMIT > .active';
	const LEVERAGE_QUERY = '.margin-leverage-or-title-row a:last-child';

	let SETTINGS = {};
	let priceObserver;
	const dialog = html.initDialog();

	function setPosSizeInput(unitOfMeasure, entry) {
		const maxRisk = SETTINGS.MAX_RISK;
		const mFee = SETTINGS.MAKER_FEE;
		const tFee = SETTINGS.TAKER_FEE;
		const portfolioPercentage = SETTINGS.PORTFOLIO_PERCENTAGE;
		const isLogger = SETTINGS.IS_LOGGER_ACTIVE;
		const isSetPosSize = SETTINGS.IS_SET_POS_SIZE;

		const entryOrderType = SETTINGS.ENTRY_ORDER_TYPE;
		const tpOrderType = SETTINGS.TP_ORDER_TYPE;
		const slOrderType = SETTINGS.SL_ORDER_TYPE;

		const stopLoss = parseFloat(document.querySelector(STOP_LOSS_QUERY).value);
		const target = parseFloat(document.querySelector(TAKE_PROFIT_QUERY).value);
		const leverage = parseFloat(document.querySelector(LEVERAGE_QUERY).innerText.slice(0, -1));
		const posSizeInput = document.querySelector(POSITION_SIZE_QUERY);
		const balance = html.getBalanceFromHtml() * (100 / portfolioPercentage);

		// have to have balance, entry and stopLoss
		if (
			!helpers.isNumber(balance)
			|| !helpers.isNumber(entry)
			|| !helpers.isNumber(stopLoss)
		)
			return false;

		const data = math.calculatePosSize(
			// dividing these with 100 because in settings
			// we enter round numbers for percentages e.g. 1% max risk
			maxRisk / 100,
			tFee / 100,
			mFee / 100,
			balance,
			entry,
			stopLoss,
			target,
			entryOrderType,
			tpOrderType,
			slOrderType,
			leverage,
		);

		const posSize = helpers.isStableCoin(unitOfMeasure)
			? data.maxPosSizeUSD
			: data.maxPosSize;

		if (isSetPosSize && helpers.isNumber(data.maxPosSize))
			html.setInputValue(posSizeInput, posSize);

		if (isLogger)
			html.logToWindow(data, posSize);
	}

	function setLimitPosSize() {
		const entry = parseFloat(document.querySelector(INPUT_PRICE_QUERY).value);
		const unitOfMeasure = document.querySelector(UOM_QUERY).innerText;
		setPosSizeInput(unitOfMeasure, entry);
	}

	function setMarketPosSize() {
		const entry = parseFloat(document.querySelector(LAST_PRICE_QUERY).innerText);
		const unitOfMeasure = document.querySelector(UOM_QUERY).innerText;
		setPosSizeInput(unitOfMeasure, entry);
	}

	function setTakeProfit(isLimit) {
		const entry = parseFloat(
			isLimit ? document.querySelector(INPUT_PRICE_QUERY).value
				: document.querySelector(LAST_PRICE_QUERY).innerText,
		);
		const stopLoss = parseFloat(document.querySelector(STOP_LOSS_QUERY).value);
		const targetInput = document.querySelector(TAKE_PROFIT_QUERY);
		const targetPrice = math.calculateTargetPrice(SETTINGS.RR_RATIO, stopLoss, entry);
		if (helpers.isNumber(targetPrice))
			html.setInputValue(targetInput, targetPrice);
	}

	function setLimitPosAndTP() {
		setLimitPosSize();
		if (SETTINGS.IS_SET_AUTO_TP)
			setTakeProfit(true);
	}

	function setMarketPosAndTP() {
		setMarketPosSize();
		if (SETTINGS.IS_SET_AUTO_TP)
			setTakeProfit(false);
	}

	function initDOMLastPriceObserver() {
		priceObserver = new MutationObserver((mutations) => {
			if (mutations[0].type === 'characterData')
				setMarketPosAndTP();
		});

		priceObserver.observe(document.querySelector(LAST_PRICE_QUERY), {
			characterData: true,
			subtree: true,
		});
	}

	function terminateDOMLastPriceObserver() {
		if (priceObserver)
			priceObserver.disconnect();
	}

	function initMarketCalculator() {
		const slInput = document.querySelector(STOP_LOSS_QUERY);
		const tpInput = document.querySelector(TAKE_PROFIT_QUERY);

		const buyMarketBtn = Array.from(document.querySelectorAll('button')).find(
			(b) =>
				b.innerText === 'Buy/Long',
		);
		const sellMarketBtn = Array.from(document.querySelectorAll('button')).find(
			(b) =>
				b.innerText === 'Sell/Short',
		);

		slInput.addEventListener('keyup', setMarketPosAndTP);
		tpInput.addEventListener('keyup', setMarketPosSize);

		function buySellOnClick(e) {
			setMarketPosAndTP();
			if (
				SETTINGS.IS_PREVENT_MARKET_BUY_WITHOUT_SL
				&& !helpers.isNumber(parseFloat(slInput.value))
			) {
				e.preventDefault();
				dialog.open('NO STOP LOSS NO TRADE!');
			}
		}

		buyMarketBtn.onclick = buySellOnClick;
		sellMarketBtn.onclick = buySellOnClick;

		// run initial calculation if we change plugin settings during the trade
		setMarketPosAndTP();
	}

	function initLimitCalculator() {
		const lastPriceBtn = Array.from(
			document
				.querySelector(ORDER_FORM_QUERY)
				.querySelectorAll(LAST_PRICE_BTN_QUERY),
		).find((c) =>
			c.innerHTML === 'Last');
		const entryInput = document.querySelector(INPUT_PRICE_QUERY);
		const slInput = document.querySelector(STOP_LOSS_QUERY);
		const tpInput = document.querySelector(TAKE_PROFIT_QUERY);

		entryInput.addEventListener('keyup', setLimitPosAndTP);
		slInput.addEventListener('keyup', setLimitPosAndTP);
		tpInput.addEventListener('keyup', setLimitPosSize);
		lastPriceBtn.addEventListener('click', setLimitPosAndTP);

		// run initial calc if we change settings during the trade
		setLimitPosAndTP();
	}

	async function initCalculator() {
		SETTINGS = await settings.loadSettings(settings);

		if (SETTINGS.IS_EXTENSION_ACTIVE) {
			if (SETTINGS.IS_HIDE_PNL)
				html.hidePnl(SETTINGS.IS_HIDE_PNL);

			const isStopLossLoaded = document.querySelector(STOP_LOSS_QUERY);
			const isLimitTabSelected = document.querySelector(TAB_LIMIT_QUERY);
			const isMarketTabSelected = document.querySelector(TAB_MARKET_QUERY);

			if (isStopLossLoaded && isLimitTabSelected) {
				terminateDOMLastPriceObserver();
				initLimitCalculator();
			} else if (isStopLossLoaded && isMarketTabSelected) {
				initMarketCalculator();
				initDOMLastPriceObserver();
			}

			if (isStopLossLoaded)
				html.initAutoTPCheckbox(isStopLossLoaded, SETTINGS);
		}
	}

	function terminateCalculator() {
		terminateDOMLastPriceObserver();
		html.removeLogWindow();
	}

	// listening for changes on settings
	chrome.storage.onChanged.addListener(() => {
		initCalculator();
	});

	html.observeHtml(
		ORDER_FORM_QUERY,
		STOP_LOSS_QUERY,
		initCalculator,
		terminateCalculator,
	);

	initCalculator();
})();
