const crypto=require('crypto');module.exports=()=>`SS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
