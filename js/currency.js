function currency(num){
  // accepts integer and rounds to significant figures
  //styles with commas, $, and k,M,B, or T as necessary
  if (num >= 1000000000000){//trillion
      return '$'+(num / 1000000000000).toFixed(2).replace(/\.0$/, '') + 'T';
    }
    else if (num >= 1000000000) {//billion
        return '$'+(num / 1000000000).toFixed(2).replace(/\.0$/, '') + 'B';
     }
     else if (num >= 1000000) {//million
        return '$'+(num / 1000000).toFixed(2).replace(/\.0$/, '') + 'M';
     }
     else if (num >= 10000) {//thousand
        return '$'+(num / 1000).toFixed(0).replace(/\.0$/, '') + 'K';
     }
     else if (num <=10000){//under 10000 use comma for thousand mark
       return '$' + num.toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
     }
     return num;
};
