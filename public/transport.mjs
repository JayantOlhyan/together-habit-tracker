// Retry reads only. Writes must never be silently submitted twice.
export function createApi(fetcher=(...args)=>fetch(...args)) {
  return async function api(path,body,method=body?'POST':'GET') {
    const attempts=method==='GET'?2:1;
    for(let attempt=0;attempt<attempts;attempt++) {
      let response;
      try {
        response=await fetcher(`/api/${path}`,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
      } catch {
        if(attempt+1<attempts) continue;
        throw new Error('Unable to connect. Check your internet connection and try again.');
      }
      if([502,503,504].includes(response.status)&&attempt+1<attempts) continue;
      let data;
      try {data=await response.json();}
      catch {throw new Error('The server could not respond. Please try again.');}
      if(!response.ok) {
        const message=response.status===429?'Too many attempts. Wait a minute and try again.':response.status>=500?'The shared store is temporarily unavailable. Please try again.':data.error||'Unable to connect.';
        const error=new Error(message);error.status=response.status;throw error;
      }
      return data;
    }
  };
}
