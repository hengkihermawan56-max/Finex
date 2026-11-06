#property strict
#property version "1.00"
#include <Trade/Trade.mqh>
// One instance per account/symbol. Server-time daily equity gate is account-wide.
input bool EnableOrders=false;
input bool AllowRealAccount=false;
input double RiskPercent=0.25;
input double DailyLossPercent=2.0;
input double RewardRisk=1.5;
input double ATRMultiple=2.0;
input int MaxSpreadPoints=100;
input ulong Magic=560611;
CTrade trade;
int fast,slow,trendFast,trendSlow,atr;
datetime lastBar=0;
string key;

bool Value(int handle,int shift,double &v) {
 double b[1]; if(CopyBuffer(handle,0,shift,1,b)!=1) return false;
 v=b[0]; return MathIsValidNumber(v) && v!=EMPTY_VALUE;
}
int OnInit() {
 if(RiskPercent<=0 || RiskPercent>1 || DailyLossPercent<=0 || DailyLossPercent>5 ||
 RewardRisk<1 || ATRMultiple<=0 || MaxSpreadPoints<=0) return INIT_PARAMETERS_INCORRECT;
 fast=iMA(_Symbol,PERIOD_M5,9,0,MODE_EMA,PRICE_CLOSE);
 slow=iMA(_Symbol,PERIOD_M5,21,0,MODE_EMA,PRICE_CLOSE);
 trendFast=iMA(_Symbol,PERIOD_M15,20,0,MODE_EMA,PRICE_CLOSE);
 trendSlow=iMA(_Symbol,PERIOD_M15,50,0,MODE_EMA,PRICE_CLOSE);
 atr=iATR(_Symbol,PERIOD_M5,14);
 if(fast==INVALID_HANDLE || slow==INVALID_HANDLE || trendFast==INVALID_HANDLE ||
 trendSlow==INVALID_HANDLE || atr==INVALID_HANDLE) return INIT_FAILED;
 key=StringFormat("HF.%I64d.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),Magic);
 trade.SetExpertMagicNumber(Magic); trade.SetDeviationInPoints(20);
 if(!trade.SetTypeFillingBySymbol(_Symbol)) return INIT_FAILED;
 lastBar=iTime(_Symbol,PERIOD_M5,0); // no entry on attach/restart
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) {
 IndicatorRelease(fast); IndicatorRelease(slow); IndicatorRelease(trendFast);
 IndicatorRelease(trendSlow); IndicatorRelease(atr); Comment("");
}
bool DailyGate() {
 MqlDateTime dt; TimeToStruct(TimeCurrent(),dt);
 double day=dt.year*10000+dt.mon*100+dt.day;
 if(!GlobalVariableCheck(key+".day") || GlobalVariableGet(key+".day")!=day) {
 GlobalVariableSet(key+".equity",AccountInfoDouble(ACCOUNT_EQUITY));
 GlobalVariableSet(key+".halt",0); GlobalVariableSet(key+".day",day);
 }
 if(!GlobalVariableCheck(key+".equity") || !GlobalVariableCheck(key+".halt")) return false;
 double base=GlobalVariableGet(key+".equity");
 if(base<=0) return false;
 if(AccountInfoDouble(ACCOUNT_EQUITY)<=base*(1-DailyLossPercent/100))
 GlobalVariableSet(key+".halt",1);
 return GlobalVariableGet(key+".halt")==0;
}
bool Busy() {
 // Avoid modifying manual positions, netting positions or existing pending orders.
 if(PositionSelect(_Symbol)) return true;
 for(int i=OrdersTotal()-1;i>=0;i--) {
 ulong ticket=OrderGetTicket(i);
 if(ticket>0 && OrderGetString(ORDER_SYMBOL)==_Symbol) return true;
 }
 return false;
}
void OnTick() {
 bool gate=DailyGate();
 Comment("HENGKI FINEX | ",EnableOrders?"ORDERS ON":"OBSERVE",gate?" | daily OK":" | DAILY HALT");
 datetime bar=iTime(_Symbol,PERIOD_M5,0);
 if(bar==0 || bar==lastBar) return;
 double f1,f2,s1,s2,t1,t2,a;
 if(!Value(fast,1,f1)||!Value(fast,2,f2)||!Value(slow,1,s1)||!Value(slow,2,s2)||
 !Value(trendFast,1,t1)||!Value(trendSlow,1,t2)||!Value(atr,1,a)||a<=0) return;
 lastBar=bar;
 bool buy=f2<=s2 && f1>s1 && t1>t2;
 bool sell=f2>=s2 && f1<s1 && t1<t2;
 if(!buy && !sell) return;
 Print("Closed-bar signal: ",buy?"BUY":"SELL");
 if(!EnableOrders || !gate || Busy()) return;
 if(AccountInfoInteger(ACCOUNT_TRADE_MODE)!=ACCOUNT_TRADE_MODE_DEMO && !AllowRealAccount) return;
 if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||
 !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)) return;
 MqlTick tick; if(!SymbolInfoTick(_Symbol,tick)||tick.ask<=0||tick.bid<=0||
 TimeCurrent()-tick.time>10 || (tick.ask-tick.bid)/_Point>MaxSpreadPoints) return;
 double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(ts<=0) return;
 double entry=buy?tick.ask:tick.bid;
 double distance=MathMax(a*ATRMultiple,(SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)+2)*_Point+tick.ask-tick.bid);
 double sl=buy?MathFloor((entry-distance)/ts)*ts:MathCeil((entry+distance)/ts)*ts;
 double tp=buy?MathCeil((entry+distance*RewardRisk)/ts)*ts:MathFloor((entry-distance*RewardRisk)/ts)*ts;
 double loss;
 ENUM_ORDER_TYPE side=buy?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
 if(sl<=0||tp<=0||!OrderCalcProfit(side,_Symbol,1,entry,sl,loss)||loss>=0) return;
 double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 double minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
 double maxLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
 if(step<=0||minLot<=0||maxLot<minLot) return;
 double budget=AccountInfoDouble(ACCOUNT_EQUITY)*RiskPercent/100;
 double lots=NormalizeDouble(MathFloor(MathMin(budget/(-loss),maxLot)/step)*step,8);
 if(lots<minLot || lots*(-loss)>budget+0.000001) { Print("Skipped: minimum volume exceeds risk budget"); return; }
 double margin;
 if(!OrderCalcMargin(side,_Symbol,lots,entry,margin)||margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)*0.8) return;
 // Persist bar BEFORE sending: uncertain results must never trigger same-bar retry.
 string bk=key+"."+_Symbol+".bar";
 if(GlobalVariableCheck(bk)&&GlobalVariableGet(bk)>=(double)bar) return;
 GlobalVariableSet(bk,(double)bar); GlobalVariablesFlush();
 bool sent=buy?trade.Buy(lots,_Symbol,0,sl,tp,"HengkiFinex"):trade.Sell(lots,_Symbol,0,sl,tp,"HengkiFinex");
 Print("Order call=",sent," retcode=",trade.ResultRetcode()," ",trade.ResultRetcodeDescription());
}
