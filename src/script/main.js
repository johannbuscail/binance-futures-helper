(async () => {
	const html = await import('./html.js');
	const math = await import('./math.js');
	const helpers = await import('./helpers.js');
	const settings = await import('./settings.js');
	const domQueries = await import('./domQueries.js');

	let SETTINGS = {};
	let NUM_OF_RELOADS = 0;
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

		const stopLoss = parseFloat(document.querySelector(domQueries.STOP_LOSS).value);
		const target = parseFloat(document.querySelector(domQueries.TAKE_PROFIT).value);
		const leverage = SETTINGS.IS_SET_USE_LEVERAGE
			? parseFloat(document.querySelector(domQueries.LEVERAGE).innerText.slice(0, -1))
			: 1;
		const posSizeInput = document.querySelector(domQueries.POSITION_SIZE);
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
		const entry = parseFloat(document.querySelector(domQueries.INPUT_PRICE).value);
		const unitOfMeasure = document.querySelector(domQueries.UOM).innerText;
		setPosSizeInput(unitOfMeasure, entry);
	}

	function setMarketPosSize() {
		const entry = parseFloat(document.querySelector(domQueries.LAST_PRICE).innerText);
		const unitOfMeasure = document.querySelector(domQueries.UOM).innerText;
		setPosSizeInput(unitOfMeasure, entry);
	}

	function setStopLoss(isLimit) {
		const entry = parseFloat(
			isLimit ? document.querySelector(domQueries.INPUT_PRICE).value
				: document.querySelector(domQueries.LAST_PRICE).innerText,
		);
		const takeProfit = parseFloat(document.querySelector(domQueries.TAKE_PROFIT).value);
		const slInput = document.querySelector(domQueries.STOP_LOSS);
		const slPrice = math.calculateStopLossFromTP(SETTINGS.RR_RATIO, takeProfit, entry);
		if (helpers.isNumber(slPrice))
			html.setInputValue(slInput, slPrice);
	}

	function setSLAndLimitPos() {
		if (SETTINGS.AUTO_SET_TPSL === 'sl')
			setStopLoss(true);
		setLimitPosSize();
	}

	function setSLAndMarketPos() {
		if (SETTINGS.AUTO_SET_TPSL === 'sl')
			setStopLoss(false);

		setMarketPosSize();
	}

	function setTakeProfit(isLimit) {
		const entry = parseFloat(
			isLimit ? document.querySelector(domQueries.INPUT_PRICE).value
				: document.querySelector(domQueries.LAST_PRICE).innerText,
		);
		const stopLoss = parseFloat(document.querySelector(domQueries.STOP_LOSS).value);
		const tpInput = document.querySelector(domQueries.TAKE_PROFIT);
		const tpPrice = math.calculateTakeProfitFromSL(SETTINGS.RR_RATIO, stopLoss, entry);
		if (helpers.isNumber(tpPrice))
			html.setInputValue(tpInput, tpPrice);
	}

	function setLimitPosAndTP() {
		setLimitPosSize();
		if (SETTINGS.AUTO_SET_TPSL === 'tp')
			setTakeProfit(true);
	}

	function setMarketPosAndTP() {
		setMarketPosSize();
		if (SETTINGS.AUTO_SET_TPSL === 'tp')
			setTakeProfit(false);
	}

	function updateMarketTPOrSL() {
		if (SETTINGS.AUTO_SET_TPSL === 'tp')
			setMarketPosAndTP();
		else if (SETTINGS.AUTO_SET_TPSL === 'sl')
			setSLAndMarketPos();
	}

	function updateLimitTPOrSL() {
		if (SETTINGS.AUTO_SET_TPSL === 'tp')
			setLimitPosAndTP();
		else if (SETTINGS.AUTO_SET_TPSL === 'sl')
			setSLAndLimitPos();
	}

	function initDOMLastPriceObserver() {
		priceObserver = new MutationObserver((mutations) => {
			if (mutations[0].type === 'characterData')
				updateMarketTPOrSL();
		});

		priceObserver.observe(document.querySelector(domQueries.LAST_PRICE), {
			characterData: true,
			subtree: true,
		});
	}

	function terminateDOMLastPriceObserver() {
		if (priceObserver)
			priceObserver.disconnect();
	}

	function initMarketCalculator() {
		const slInput = document.querySelector(domQueries.STOP_LOSS);
		const tpInput = document.querySelector(domQueries.TAKE_PROFIT);

		const buyMarketBtn = Array.from(document.querySelectorAll('button')).find(
			(b) =>
				b.innerText === 'Buy/Long',
		);
		const sellMarketBtn = Array.from(document.querySelectorAll('button')).find(
			(b) =>
				b.innerText === 'Sell/Short',
		);

		slInput.addEventListener('keyup', setMarketPosAndTP);
		tpInput.addEventListener('keyup', setSLAndMarketPos);

		function buySellOnClick(e) {
			// update one last time the stop loss or take profit before placing the order
			updateMarketTPOrSL();

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
		updateMarketTPOrSL();
	}

	function initLimitCalculator() {
		const lastPriceBtn = Array.from(
			document
				.querySelector(domQueries.ORDER_FORM)
				.querySelectorAll(domQueries.LAST_PRICE_BTN),
		).find((c) =>
			c.innerHTML === 'Last');
		const entryInput = document.querySelector(domQueries.INPUT_PRICE);
		const slInput = document.querySelector(domQueries.STOP_LOSS);
		const tpInput = document.querySelector(domQueries.TAKE_PROFIT);

		entryInput.addEventListener('keyup', updateLimitTPOrSL);
		slInput.addEventListener('keyup', setLimitPosAndTP);
		tpInput.addEventListener('keyup', setSLAndLimitPos);
		lastPriceBtn.addEventListener('click', updateLimitTPOrSL);

		// run initial calc if we change settings during the trade
		updateLimitTPOrSL();
	}

	async function initCalculator() {
		SETTINGS = await settings.loadSettings(settings);

		if (SETTINGS.IS_EXTENSION_ACTIVE) {
			// only init on first load
			if (NUM_OF_RELOADS === 0) {
				html.initCheckboxStyles();
				html.initRadioStyles();
			}

			if (SETTINGS.IS_HIDE_PNL)
				html.hidePnl(SETTINGS.IS_HIDE_PNL);

			const isStopLossLoaded = document.querySelector(domQueries.STOP_LOSS);
			const isLimitTabSelected = document.querySelector(domQueries.TAB_LIMIT);
			const isMarketTabSelected = document.querySelector(domQueries.TAB_MARKET);

			if (isStopLossLoaded && isLimitTabSelected) {
				terminateDOMLastPriceObserver();
				initLimitCalculator();
			} else if (isStopLossLoaded && isMarketTabSelected) {
				initMarketCalculator();
				initDOMLastPriceObserver();
			}

			if (isStopLossLoaded) {
				html.initUseLeverageCheckbox(isStopLossLoaded, SETTINGS);
				html.initAutoTPSLRadio(isStopLossLoaded, SETTINGS);
			}
		}

		NUM_OF_RELOADS += 1;
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
		domQueries.ORDER_FORM,
		domQueries.STOP_LOSS,
		initCalculator,
		terminateCalculator,
	);

	initCalculator();
})();
