(() => {
  const client = window.EeveeSupabase;
  let resolveReady;
  const ready = new Promise(resolve => resolveReady = resolve);

  function showLogin(show){
    const screen=document.getElementById('loginScreen');
    if(screen) screen.hidden=!show;
    document.body.classList.toggle('auth-locked', show);
  }
  async function init(){
    const form=document.getElementById('loginForm');
    const logout=document.getElementById('logoutButton');
    form?.addEventListener('submit', async e=>{
      e.preventDefault();
      const errorBox=document.getElementById('loginError');
      errorBox.textContent='';
      const {data,error}=await client.auth.signInWithPassword({
        email:document.getElementById('loginEmail').value.trim(),
        password:document.getElementById('loginPassword').value
      });
      if(error){ errorBox.textContent='로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.'; return; }
      showLogin(false); resolveReady(data.user);
    });
    logout?.addEventListener('click', async()=>{ await client.auth.signOut(); location.reload(); });
    const {data:{session}}=await client.auth.getSession();
    if(session?.user){ showLogin(false); resolveReady(session.user); }
    else showLogin(true);
  }
  window.EeveeAuth={ready};
  init();
})();
