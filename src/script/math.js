// the logic behind the plugin
export const calculatePosSize = (
	maxRiskConst,
	takerFeeConst,
	makerFeeConst,
	balance,
	entry,
	stopLoss,
	target,
	entryOrderType,
	tpOrderType,
	slOrderType,
) => {
	function calcFee(type) {
		return type === 'market' ? makerFeeConst : takerFeeConst;
	}

	// basic stuff
	const isLong = entry > stopLoss;
	const maxToRiskAmount = balance * maxRiskConst * -1;

	// risk : reward
	const rewardPerUnit = isLong ? target - entry : entry - target;
	const riskPerUnit = isLong ? stopLoss - entry : entry - stopLoss;
	const riskReward = rewardPerUnit / -riskPerUnit;

	// max position - calculating stop loss fee in
	const totalCostPerUnit = isLong ? stopLoss - entry : entry - stopLoss;
	const maxPosSize = maxToRiskAmount / totalCostPerUnit;
	const maxPosSizeUSD = (maxToRiskAmount / totalCostPerUnit) * entry;

	// fees
	const entryFee = entry * calcFee(entryOrderType) * maxPosSize * -1;
	const stopLossFee = stopLoss * calcFee(slOrderType) * maxPosSize * -1;
	const takeProfitFee = target * calcFee(tpOrderType) * maxPosSize * -1;

	// totals after deducting fees
	const totalReward = isLong
		? maxPosSize * target - maxPosSize * entry
		: maxPosSize * entry - maxPosSize * target;

	return {
		maxRiskConst,
		takerFeeConst,
		makerFeeConst,
		balance,
		entry,
		stopLoss,
		target,
		isLong,
		maxToRiskAmount,
		rewardPerUnit,
		riskPerUnit,
		riskReward,
		totalCostPerUnit,
		maxPosSize,
		maxPosSizeUSD,
		entryFee,
		stopLossFee,
		takeProfitFee,
		totalReward,
	};
};

export const calculateTargetPrice = (rrRatio, stopLoss, entry) => {
	const targetPrice = entry + (entry - stopLoss) * rrRatio;
	return targetPrice;
};
